export type ScopeGroup = "webmaster_console" | "analytics_property";

export interface GoogleTokenRow {
  account_email: string;
  scope_group: ScopeGroup;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  tenant_id: string | null;
  updated_at: string;
}

/**
 * Every function here takes an optional `tenantId`, defaulting to `null`:
 * see websites.ts's doc comment for the same pattern. Note the primary key
 * is still `(account_email, scope_group)` (from migration 0001): a given
 * tenant is assumed to connect at most one Google account per scope group;
 * see getAnyToken's own note on that.
 */
export async function hasAnyToken(
  db: D1Database,
  scopeGroup: ScopeGroup,
  tenantId: string | null = null
): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM google_tokens WHERE scope_group = ?1 AND tenant_id IS ?2 LIMIT 1")
    .bind(scopeGroup, tenantId)
    .first();
  return row !== null;
}

export async function getToken(
  db: D1Database,
  scopeGroup: ScopeGroup,
  accountEmail: string,
  tenantId: string | null = null
): Promise<GoogleTokenRow | null> {
  const row = await db
    .prepare(
      "SELECT * FROM google_tokens WHERE scope_group = ?1 AND account_email = ?2 AND tenant_id IS ?3"
    )
    .bind(scopeGroup, accountEmail, tenantId)
    .first<GoogleTokenRow>();
  return row ?? null;
}

/**
 * This is a personal, single-user server in self-host mode: v1 doesn't
 * bind a website to a specific connected Google account, so "the" token
 * for a scope group is whichever one was connected/refreshed most
 * recently. In cloud mode this is scoped per tenant, so it resolves to
 * that tenant's one connected account for the scope group, still at most
 * one account per tenant per scope group, not one globally.
 */
export async function getAnyToken(
  db: D1Database,
  scopeGroup: ScopeGroup,
  tenantId: string | null = null
): Promise<GoogleTokenRow | null> {
  const row = await db
    .prepare(
      "SELECT * FROM google_tokens WHERE scope_group = ?1 AND tenant_id IS ?2 ORDER BY updated_at DESC LIMIT 1"
    )
    .bind(scopeGroup, tenantId)
    .first<GoogleTokenRow>();
  return row ?? null;
}

/** Removes the tenant's stored token for a scope group ("disconnect"). false if nothing was connected. */
export async function deleteToken(db: D1Database, scopeGroup: ScopeGroup, tenantId: string | null = null): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM google_tokens WHERE scope_group = ?1 AND tenant_id IS ?2")
    .bind(scopeGroup, tenantId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function upsertToken(
  db: D1Database,
  row: Omit<GoogleTokenRow, "updated_at">
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO google_tokens (account_email, scope_group, access_token, refresh_token, expires_at, tenant_id, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
       ON CONFLICT (account_email, scope_group) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         tenant_id = excluded.tenant_id,
         updated_at = datetime('now')`
    )
    .bind(
      row.account_email,
      row.scope_group,
      row.access_token,
      row.refresh_token,
      row.expires_at,
      row.tenant_id
    )
    .run();
}
