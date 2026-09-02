const KEY_PREFIX = "mst_"; // mcp-seo-toolkit — a recognizable, greppable prefix, same idea as Stripe's sk_live_

export interface McpApiKeyRow {
  key_id: string;
  tenant_id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CreatedApiKey {
  keyId: string;
  /** Shown to the caller exactly once — only its hash is ever stored. */
  plaintext: string;
}

export async function createApiKey(
  db: D1Database,
  tenantId: string,
  label?: string
): Promise<CreatedApiKey> {
  const keyId = crypto.randomUUID();
  const secret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const plaintext = `${KEY_PREFIX}${secret}`;
  const keyHash = await sha256Hex(plaintext);

  await db
    .prepare("INSERT INTO mcp_api_keys (key_id, key_hash, tenant_id, label) VALUES (?1, ?2, ?3, ?4)")
    .bind(keyId, keyHash, tenantId, label ?? null)
    .run();

  return { keyId, plaintext };
}

/** Returns the owning tenant id for a valid key, or null. Touches `last_used_at` on success. */
export async function verifyApiKey(db: D1Database, plaintext: string): Promise<string | null> {
  if (!plaintext.startsWith(KEY_PREFIX)) return null;
  const keyHash = await sha256Hex(plaintext);

  const row = await db
    .prepare("SELECT tenant_id FROM mcp_api_keys WHERE key_hash = ?1")
    .bind(keyHash)
    .first<{ tenant_id: string }>();
  if (!row) return null;

  await db
    .prepare("UPDATE mcp_api_keys SET last_used_at = datetime('now') WHERE key_hash = ?1")
    .bind(keyHash)
    .run();

  return row.tenant_id;
}

/** Never returns the hash or plaintext — only what's safe to show in a dashboard list. */
export async function listApiKeys(db: D1Database, tenantId: string): Promise<McpApiKeyRow[]> {
  const { results } = await db
    .prepare(
      "SELECT key_id, tenant_id, label, created_at, last_used_at FROM mcp_api_keys WHERE tenant_id = ?1 ORDER BY created_at DESC"
    )
    .bind(tenantId)
    .all<McpApiKeyRow>();
  return results;
}

/** Returns false if no matching key existed for this tenant (already revoked, or not theirs). */
export async function revokeApiKey(db: D1Database, tenantId: string, keyId: string): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM mcp_api_keys WHERE key_id = ?1 AND tenant_id = ?2")
    .bind(keyId, tenantId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
