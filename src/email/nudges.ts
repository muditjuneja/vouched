import { hasEmail, isCloudMode, type Env } from "../types/env";
import { sendAdminAlert } from "../lib/alerts";
import { markNotifiedWithCooldown, sendOnce } from "./dedup";
import { notifyConnectGoogleNudge } from "./notifications";

/** Notice key in tenant_notifications: one nudge per person, ever. */
export const CONNECT_GOOGLE_NUDGE_KEY = "nudge_connect_google";
/** Notice key stamping each attempt, successful or not: caps retries of a failing send at one a day. */
export const CONNECT_GOOGLE_NUDGE_ATTEMPT_KEY = "nudge_connect_google_attempt";

/** Give people a day after signing up to connect Google on their own before nudging. */
const NUDGE_AFTER_HOURS = 24;
/** A send that failed (no email in Clerk, a delivery error) is tried again this long after, not on every hourly run. */
const RETRY_AFTER_HOURS = 24;
/** Past this, they've gone quiet; an email out of nowhere would be noise. Also keeps the first run from mailing anyone ancient. */
const NUDGE_WITHIN_DAYS = 14;
/**
 * One run never handles more than this; the rest go out on the next hourly
 * run (240 a day at this size). Sized for the Workers free plan's
 * per-invocation caps of 50 D1 queries and 50 subrequests: each candidate
 * costs up to 4 queries (attempt read + write, claim, release on failure)
 * and 2 fetches (Clerk for the address, xmit.sh to send), plus the one
 * candidate query and the admin alert.
 */
const BATCH_LIMIT = 10;

export interface NudgeCandidate {
  user_id: string;
  /** Null when they never approved a client on /authorize: they connected with an API key, or haven't connected anything yet. */
  first_client_name: string | null;
}

/**
 * People who signed up 1 to 14 days ago and still have no Google connection
 * in the workspace they use (a team member's is the team's), haven't been
 * nudged, and weren't tried in the last day. Without Google the product has
 * nothing to read, whether they connected an MCP client (the first Cursor
 * signup sat like that for 11 days, every call coming back empty), connected
 * with an API key (no client name is ever recorded for those), or never got
 * as far as connecting one.
 *
 * julianday() rather than string comparison: backfilled signed_up_at values
 * have no milliseconds ("...:17Z") while new ones do ("...:17.000Z").
 */
export async function findConnectGoogleNudges(db: D1Database, now: Date = new Date()): Promise<NudgeCandidate[]> {
  const signedUpBefore = new Date(now.getTime() - NUDGE_AFTER_HOURS * 3600_000).toISOString();
  const signedUpAfter = new Date(now.getTime() - NUDGE_WITHIN_DAYS * 86400_000).toISOString();
  const triedAfter = new Date(now.getTime() - RETRY_AFTER_HOURS * 3600_000).toISOString();
  const { results } = await db
    .prepare(
      `SELECT s.user_id, s.first_client_name
       FROM signups s
       WHERE julianday(s.signed_up_at) <= julianday(?1)
         AND julianday(s.signed_up_at) >= julianday(?2)
         AND NOT EXISTS (
           SELECT 1 FROM google_tokens g
           WHERE g.tenant_id = COALESCE((SELECT m.tenant_id FROM tenant_members m WHERE m.user_id = s.user_id), s.user_id)
         )
         AND NOT EXISTS (
           SELECT 1 FROM tenant_notifications n WHERE n.tenant_id = s.user_id AND n.notice_key = ?3
         )
         AND NOT EXISTS (
           SELECT 1 FROM tenant_notifications n
           WHERE n.tenant_id = s.user_id AND n.notice_key = ?4 AND julianday(n.sent_at) > julianday(?5)
         )
       ORDER BY julianday(s.signed_up_at)
       LIMIT ?6`
    )
    .bind(signedUpBefore, signedUpAfter, CONNECT_GOOGLE_NUDGE_KEY, CONNECT_GOOGLE_NUDGE_ATTEMPT_KEY, triedAfter, BATCH_LIMIT)
    .all<NudgeCandidate>();
  return results;
}

/**
 * The hourly cron (wrangler.jsonc "triggers"). Hourly so each person is
 * nudged about 24 hours after they signed up, around the same time of day
 * they were last at their computer, instead of at one fixed hour that's
 * night for someone.
 *
 * Each candidate's attempt is stamped first (at most one a day), then the
 * nudge is sent once ever: sendOnce claims the key before sending, so an
 * overlapping run can't double-send, and releases it if the send fails, so
 * the next day's attempt can try again. Never throws.
 */
export async function runNudges(env: Env, now: Date = new Date()): Promise<{ sent: number; candidates: number }> {
  if (!isCloudMode(env) || !hasEmail(env)) return { sent: 0, candidates: 0 };
  try {
    const candidates = await findConnectGoogleNudges(env.DB, now);
    let sent = 0;
    for (const c of candidates) {
      if (!(await markNotifiedWithCooldown(env.DB, c.user_id, CONNECT_GOOGLE_NUDGE_ATTEMPT_KEY, RETRY_AFTER_HOURS, now))) continue;
      const ok = await sendOnce(env.DB, c.user_id, CONNECT_GOOGLE_NUDGE_KEY, () => notifyConnectGoogleNudge(env, c.user_id, c.first_client_name));
      if (ok) sent++;
    }
    if (candidates.length > 0) {
      console.log(`[nudges] connect-google: sent ${sent} of ${candidates.length}`);
      if (sent > 0) {
        await sendAdminAlert(env, `Sent ${sent} "connect Google" nudge${sent === 1 ? "" : "s"} to recent signups with no Google connection`);
      }
    }
    return { sent, candidates: candidates.length };
  } catch (error) {
    console.error(`[nudges] failed: ${String(error)}`);
    return { sent: 0, candidates: 0 };
  }
}
