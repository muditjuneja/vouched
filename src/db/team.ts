import { TEAM_INVITE_TTL_DAYS, TEAM_SEATS } from "../billing/quotas";
import { sha256Hex } from "../lib/hash";
import { revokeKeysCreatedBy } from "./mcp-api-keys";
import { getEffectivePlan } from "./subscriptions";

/**
 * Who the signed-in user is acting as. `tenantId` is the workspace every
 * query should be scoped to: the user's own id for their personal
 * workspace (or a team they own), the owner's id when they're a member of
 * someone else's team. Existing single-user data needs no migration: a
 * workspace's id has always been its owner's Clerk user id.
 */
export interface TenantContext {
  userId: string;
  tenantId: string;
  role: "owner" | "member";
  /** Set when the user is a member of a team whose plan has lapsed: they're back in their personal workspace until it's renewed. */
  pausedTeamId: string | null;
}

export async function getMembership(db: D1Database, userId: string): Promise<{ tenant_id: string; created_at: string } | null> {
  const row = await db
    .prepare("SELECT tenant_id, created_at FROM tenant_members WHERE user_id = ?1")
    .bind(userId)
    .first<{ tenant_id: string; created_at: string }>();
  return row ?? null;
}

/**
 * The one place a signed-in Clerk user becomes a workspace. Membership only
 * counts while the team's plan is actually Team: if it lapses, members
 * fall back to their own personal workspace (which was never touched) and
 * return automatically once it's renewed.
 */
export async function resolveTenant(db: D1Database, userId: string, now: Date = new Date()): Promise<TenantContext> {
  const membership = await getMembership(db, userId);
  if (!membership) return { userId, tenantId: userId, role: "owner", pausedTeamId: null };

  const teamPlan = await getEffectivePlan(db, membership.tenant_id, now);
  if (teamPlan === "team") {
    return { userId, tenantId: membership.tenant_id, role: "member", pausedTeamId: null };
  }
  return { userId, tenantId: userId, role: "owner", pausedTeamId: membership.tenant_id };
}

export interface TeamMemberRow {
  user_id: string;
  created_at: string;
}

export async function listMembers(db: D1Database, tenantId: string): Promise<TeamMemberRow[]> {
  const { results } = await db
    .prepare("SELECT user_id, created_at FROM tenant_members WHERE tenant_id = ?1 ORDER BY created_at ASC")
    .bind(tenantId)
    .all<TeamMemberRow>();
  return results;
}

export interface TeamInviteRow {
  invite_id: string;
  tenant_id: string;
  email: string;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
}

/** Invites not yet accepted and not yet expired. These hold a seat. */
export async function listPendingInvites(db: D1Database, tenantId: string, now: Date = new Date()): Promise<TeamInviteRow[]> {
  const { results } = await db
    .prepare(
      `SELECT invite_id, tenant_id, email, invited_by, created_at, expires_at, accepted_at, accepted_by
       FROM tenant_invites WHERE tenant_id = ?1 AND accepted_at IS NULL AND expires_at > ?2
       ORDER BY created_at ASC`
    )
    .bind(tenantId, now.toISOString())
    .all<TeamInviteRow>();
  return results;
}

/** Owner + members + pending invites. */
export async function seatsUsed(db: D1Database, tenantId: string, now: Date = new Date()): Promise<number> {
  const [members, pending] = await Promise.all([listMembers(db, tenantId), listPendingInvites(db, tenantId, now)]);
  return 1 + members.length + pending.length;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Creates an invite and returns its plaintext token (only ever put in the
 * invite email). Callers check the plan, the owner role and free seats
 * first; this just writes the row.
 */
export async function createInvite(
  db: D1Database,
  tenantId: string,
  email: string,
  invitedBy: string,
  now: Date = new Date()
): Promise<{ inviteId: string; token: string }> {
  const inviteId = crypto.randomUUID();
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(now.getTime() + TEAM_INVITE_TTL_DAYS * 86_400_000).toISOString();
  await db
    .prepare(
      `INSERT INTO tenant_invites (invite_id, token_hash, tenant_id, email, invited_by, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(inviteId, await sha256Hex(token), tenantId, normalizeEmail(email), invitedBy, expiresAt)
    .run();
  return { inviteId, token };
}

export async function getInviteByToken(db: D1Database, token: string): Promise<TeamInviteRow | null> {
  const row = await db
    .prepare(
      `SELECT invite_id, tenant_id, email, invited_by, created_at, expires_at, accepted_at, accepted_by
       FROM tenant_invites WHERE token_hash = ?1`
    )
    .bind(await sha256Hex(token))
    .first<TeamInviteRow>();
  return row ?? null;
}

/** Withdraws a still-pending invite, freeing its seat. Accepted invites can't be revoked (remove the member instead). */
export async function revokeInvite(db: D1Database, tenantId: string, inviteId: string): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM tenant_invites WHERE invite_id = ?1 AND tenant_id = ?2 AND accepted_at IS NULL")
    .bind(inviteId, tenantId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export type InviteBlocker =
  | "not_found"
  | "expired"
  | "already_used"
  | "own_team"
  | "wrong_email"
  | "already_member"
  | "owns_team"
  | "has_paid_plan"
  | "team_inactive"
  | "team_full";

/**
 * Everything that has to be true before `userId` (signed in as
 * `userEmail`) can take this invite, as the first failing reason, or null.
 * The same check drives the accept page's message and the accept action,
 * so what the page says is exactly what the POST enforces.
 */
export async function checkInvite(
  db: D1Database,
  invite: TeamInviteRow | null,
  userId: string,
  userEmail: string | null,
  now: Date = new Date()
): Promise<InviteBlocker | null> {
  if (!invite) return "not_found";
  if (invite.accepted_at) return "already_used";
  if (invite.expires_at <= now.toISOString()) return "expired";
  if (invite.tenant_id === userId) return "own_team";
  // The link alone isn't enough: it has to be opened by the person it was
  // sent to, so a forwarded or leaked link can't hand out a seat.
  if (!userEmail || normalizeEmail(userEmail) !== invite.email) return "wrong_email";
  if (await getMembership(db, userId)) return "already_member";
  // An owner whose Team plan lapsed is back on free, but their members still
  // point at their workspace. Joining elsewhere would strand those members
  // and leave the owner unable to renew (checkout refuses members).
  if ((await listMembers(db, userId)).length > 0) return "owns_team";
  // Nobody pays twice by accident: their own subscription has to be
  // cancelled before their account moves onto someone else's plan.
  if ((await getEffectivePlan(db, userId, now)) !== "free") return "has_paid_plan";
  if ((await getEffectivePlan(db, invite.tenant_id, now)) !== "team") return "team_inactive";
  // This invite already holds one of the pending seats, so only owner +
  // existing members have to fit below the limit.
  const members = await listMembers(db, invite.tenant_id);
  if (1 + members.length >= TEAM_SEATS) return "team_full";
  return null;
}

/**
 * Claims the invite first (a conditional update, so two tabs can't both
 * accept it), then adds the membership. If adding fails (the user joined
 * another team in between), the claim is undone so the invite stays
 * usable.
 */
export async function acceptInvite(db: D1Database, invite: TeamInviteRow, userId: string, now: Date = new Date()): Promise<boolean> {
  const claimed = await db
    .prepare(
      `UPDATE tenant_invites SET accepted_at = ?1, accepted_by = ?2
       WHERE invite_id = ?3 AND accepted_at IS NULL AND expires_at > ?1`
    )
    .bind(now.toISOString(), userId, invite.invite_id)
    .run();
  if ((claimed.meta.changes ?? 0) === 0) return false;

  try {
    await db.prepare("INSERT INTO tenant_members (user_id, tenant_id) VALUES (?1, ?2)").bind(userId, invite.tenant_id).run();
    return true;
  } catch (error) {
    await db
      .prepare("UPDATE tenant_invites SET accepted_at = NULL, accepted_by = NULL WHERE invite_id = ?1")
      .bind(invite.invite_id)
      .run();
    throw error;
  }
}

/** Removes a member and revokes every API key they created in the workspace. */
export async function removeMember(db: D1Database, tenantId: string, userId: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM tenant_members WHERE user_id = ?1 AND tenant_id = ?2").bind(userId, tenantId).run();
  if ((result.meta.changes ?? 0) === 0) return false;
  await revokeKeysCreatedBy(db, tenantId, userId);
  return true;
}

/** The member's own "leave team": same cleanup as being removed. */
export async function leaveTeam(db: D1Database, userId: string): Promise<boolean> {
  const membership = await getMembership(db, userId);
  if (!membership) return false;
  return removeMember(db, membership.tenant_id, userId);
}
