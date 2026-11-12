/** How a person was first seen, see migrations/0010_signups.sql. */
export type SignupSource = "clerk_webhook" | "mcp_authorize" | "dashboard";

export interface SignupRow {
  user_id: string;
  signed_up_at: string;
  first_seen_via: string;
  first_client_name: string | null;
  first_client_at: string | null;
}

/**
 * Records that `userId` exists. Returns true only for the call that created
 * the row (a genuinely new person); later calls return false, but still
 * pull `signed_up_at` back to the earliest time anyone reported, so Clerk's
 * own creation time wins over "first seen" whichever arrives first.
 */
export async function recordSignup(db: D1Database, userId: string, source: SignupSource, signedUpAt: string): Promise<boolean> {
  const inserted = await db
    .prepare("INSERT OR IGNORE INTO signups (user_id, signed_up_at, first_seen_via) VALUES (?1, ?2, ?3)")
    .bind(userId, signedUpAt, source)
    .run();
  if ((inserted.meta.changes ?? 0) > 0) return true;
  await db.prepare("UPDATE signups SET signed_up_at = ?2 WHERE user_id = ?1 AND signed_up_at > ?2").bind(userId, signedUpAt).run();
  return false;
}

/** Stamps the first MCP client a person approved. Returns true only the first time; later clients leave it unchanged. */
export async function recordFirstClient(db: D1Database, userId: string, clientName: string, at: string): Promise<boolean> {
  const result = await db
    .prepare("UPDATE signups SET first_client_name = ?2, first_client_at = ?3 WHERE user_id = ?1 AND first_client_name IS NULL")
    .bind(userId, clientName, at)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * The cheap "anything left to do?" check run on every dashboard request: one
 * read instead of two writes, for the common case of a known, already
 * welcomed user.
 */
export async function getOnboardingState(db: D1Database, userId: string): Promise<{ known: boolean; welcomed: boolean; hasClient: boolean }> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT first_client_name IS NOT NULL FROM signups WHERE user_id = ?1) AS has_client,
         EXISTS (SELECT 1 FROM signups WHERE user_id = ?1) AS known,
         EXISTS (SELECT 1 FROM tenant_notifications WHERE tenant_id = ?1 AND notice_key = 'welcome') AS welcomed`
    )
    .bind(userId)
    .first<{ known: number; welcomed: number; has_client: number | null }>();
  return { known: Boolean(row?.known), welcomed: Boolean(row?.welcomed), hasClient: Boolean(row?.has_client) };
}
