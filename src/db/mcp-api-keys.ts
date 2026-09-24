import { sha256Hex } from "../lib/hash";
import { KEY_PREFIX } from "../lib/product";

export interface McpApiKeyRow {
  key_id: string;
  tenant_id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface CreatedApiKey {
  keyId: string;
  /** Shown to the caller exactly once; only its hash is ever stored. */
  plaintext: string;
}

/**
 * `createdBy` is the Clerk user who made the key. On a team, members make
 * keys under the team's tenant_id, so this is what lets a removed member's
 * keys be revoked and keeps members from seeing each other's keys.
 */
export async function createApiKey(
  db: D1Database,
  tenantId: string,
  label?: string,
  createdBy: string = tenantId
): Promise<CreatedApiKey> {
  const keyId = crypto.randomUUID();
  const secret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const plaintext = `${KEY_PREFIX}${secret}`;
  const keyHash = await sha256Hex(plaintext);

  await db
    .prepare("INSERT INTO mcp_api_keys (key_id, key_hash, tenant_id, label, created_by) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(keyId, keyHash, tenantId, label ?? null, createdBy)
    .run();

  return { keyId, plaintext };
}

export interface VerifiedApiKey {
  tenantId: string;
  /** Who created the key. Keys from before seats existed have no creator recorded; they belong to the owner, whose id is the tenant id. */
  createdBy: string;
}

/** Returns the owning tenant and the key's creator for a valid key, or null. Touches `last_used_at` on success. */
export async function verifyApiKey(db: D1Database, plaintext: string): Promise<VerifiedApiKey | null> {
  if (!plaintext.startsWith(KEY_PREFIX)) return null;
  const keyHash = await sha256Hex(plaintext);

  const row = await db
    .prepare("SELECT tenant_id, created_by FROM mcp_api_keys WHERE key_hash = ?1")
    .bind(keyHash)
    .first<{ tenant_id: string; created_by: string | null }>();
  if (!row) return null;

  await db
    .prepare("UPDATE mcp_api_keys SET last_used_at = datetime('now') WHERE key_hash = ?1")
    .bind(keyHash)
    .run();

  return { tenantId: row.tenant_id, createdBy: row.created_by ?? row.tenant_id };
}

/**
 * Only the keys `userId` created in this workspace, never the hash or
 * plaintext. Each person on a team manages just their own keys;
 * pre-seats keys (no creator recorded) count as the owner's.
 */
export async function listApiKeys(db: D1Database, tenantId: string, userId: string = tenantId): Promise<McpApiKeyRow[]> {
  const { results } = await db
    .prepare(
      `SELECT key_id, tenant_id, label, created_at, last_used_at FROM mcp_api_keys
       WHERE tenant_id = ?1 AND COALESCE(created_by, tenant_id) = ?2
       ORDER BY created_at DESC`
    )
    .bind(tenantId, userId)
    .all<McpApiKeyRow>();
  return results;
}

/** Returns false if no matching key existed for this user in this workspace (already revoked, or not theirs). */
export async function revokeApiKey(db: D1Database, tenantId: string, keyId: string, userId: string = tenantId): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM mcp_api_keys WHERE key_id = ?1 AND tenant_id = ?2 AND COALESCE(created_by, tenant_id) = ?3")
    .bind(keyId, tenantId, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** Revokes every key a member created in a workspace: called when they leave or are removed. */
export async function revokeKeysCreatedBy(db: D1Database, tenantId: string, userId: string): Promise<number> {
  const result = await db
    .prepare("DELETE FROM mcp_api_keys WHERE tenant_id = ?1 AND created_by = ?2")
    .bind(tenantId, userId)
    .run();
  return result.meta.changes ?? 0;
}
