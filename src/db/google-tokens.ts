export type ScopeGroup = "webmaster_console" | "analytics_property";

export interface GoogleTokenRow {
  account_email: string;
  scope_group: ScopeGroup;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  updated_at: string;
}

/**
 * Connection state for one scope group, independent of which website it
 * ends up resolving to — `list_websites` just needs "is there any usable
 * token at all", `gsc`/`analytics` handlers need the specific row.
 */
export async function hasAnyToken(db: D1Database, scopeGroup: ScopeGroup): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM google_tokens WHERE scope_group = ?1 LIMIT 1")
    .bind(scopeGroup)
    .first();
  return row !== null;
}

export async function getToken(
  db: D1Database,
  scopeGroup: ScopeGroup,
  accountEmail: string
): Promise<GoogleTokenRow | null> {
  const row = await db
    .prepare("SELECT * FROM google_tokens WHERE scope_group = ?1 AND account_email = ?2")
    .bind(scopeGroup, accountEmail)
    .first<GoogleTokenRow>();
  return row ?? null;
}

export async function upsertToken(
  db: D1Database,
  row: Omit<GoogleTokenRow, "updated_at">
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO google_tokens (account_email, scope_group, access_token, refresh_token, expires_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
       ON CONFLICT (account_email, scope_group) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         updated_at = datetime('now')`
    )
    .bind(row.account_email, row.scope_group, row.access_token, row.refresh_token, row.expires_at)
    .run();
}
