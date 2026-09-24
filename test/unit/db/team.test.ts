import { beforeEach, describe, expect, it, vi } from "vitest";

// Plans and API keys live in other tables with their own tests; here only
// "what plan is this workspace on" and "were the member's keys revoked"
// matter, so both are stubbed.
const { getEffectivePlan, revokeKeysCreatedBy } = vi.hoisted(() => ({
  getEffectivePlan: vi.fn(),
  revokeKeysCreatedBy: vi.fn()
}));
vi.mock("../../../src/db/subscriptions", () => ({ getEffectivePlan }));
vi.mock("../../../src/db/mcp-api-keys", () => ({ revokeKeysCreatedBy }));

import { TEAM_SEATS } from "../../../src/billing/quotas";
import {
  acceptInvite,
  checkInvite,
  createInvite,
  getInviteByToken,
  leaveTeam,
  listPendingInvites,
  removeMember,
  resolveTenant,
  revokeInvite,
  seatsUsed
} from "../../../src/db/team";

/** In-memory fake of tenant_members + tenant_invites, matching the statements src/db/team.ts issues. */
function fakeTeamDb() {
  const members = new Map<string, { user_id: string; tenant_id: string; created_at: string }>();
  interface Invite {
    invite_id: string;
    token_hash: string;
    tenant_id: string;
    email: string;
    invited_by: string;
    created_at: string;
    expires_at: string;
    accepted_at: string | null;
    accepted_by: string | null;
  }
  const invites: Invite[] = [];
  const strip = ({ token_hash: _hash, ...rest }: Invite) => rest;

  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT INTO tenant_invites")) {
                const [invite_id, token_hash, tenant_id, email, invited_by, expires_at] = args as string[];
                invites.push({
                  invite_id: invite_id!,
                  token_hash: token_hash!,
                  tenant_id: tenant_id!,
                  email: email!,
                  invited_by: invited_by!,
                  created_at: new Date().toISOString(),
                  expires_at: expires_at!,
                  accepted_at: null,
                  accepted_by: null
                });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("INSERT INTO tenant_members")) {
                const [user_id, tenant_id] = args as [string, string];
                if (members.has(user_id)) throw new Error("UNIQUE constraint failed: tenant_members.user_id");
                members.set(user_id, { user_id, tenant_id, created_at: new Date().toISOString() });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("SET accepted_at = ?1, accepted_by = ?2")) {
                const [now, userId, inviteId] = args as [string, string, string];
                const inv = invites.find((i) => i.invite_id === inviteId && i.accepted_at === null && i.expires_at > now);
                if (!inv) return { meta: { changes: 0 } };
                inv.accepted_at = now;
                inv.accepted_by = userId;
                return { meta: { changes: 1 } };
              }
              if (sql.includes("SET accepted_at = NULL")) {
                const inv = invites.find((i) => i.invite_id === args[0]);
                if (inv) inv.accepted_at = inv.accepted_by = null;
                return { meta: { changes: inv ? 1 : 0 } };
              }
              if (sql.startsWith("DELETE FROM tenant_invites")) {
                const [inviteId, tenantId] = args as [string, string];
                const idx = invites.findIndex((i) => i.invite_id === inviteId && i.tenant_id === tenantId && i.accepted_at === null);
                if (idx === -1) return { meta: { changes: 0 } };
                invites.splice(idx, 1);
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("DELETE FROM tenant_members")) {
                const [userId, tenantId] = args as [string, string];
                const row = members.get(userId);
                if (!row || row.tenant_id !== tenantId) return { meta: { changes: 0 } };
                members.delete(userId);
                return { meta: { changes: 1 } };
              }
              throw new Error(`unhandled run(): ${sql}`);
            },
            async first<T>() {
              if (sql.includes("FROM tenant_members WHERE user_id")) {
                const row = members.get(args[0] as string);
                return (row ? { tenant_id: row.tenant_id, created_at: row.created_at } : null) as T | null;
              }
              if (sql.includes("FROM tenant_invites WHERE token_hash")) {
                const inv = invites.find((i) => i.token_hash === args[0]);
                return (inv ? strip(inv) : null) as T | null;
              }
              throw new Error(`unhandled first(): ${sql}`);
            },
            async all<T>() {
              if (sql.includes("FROM tenant_members WHERE tenant_id")) {
                const results = [...members.values()].filter((m) => m.tenant_id === args[0]).map(({ user_id, created_at }) => ({ user_id, created_at }));
                return { results: results as T[] };
              }
              if (sql.includes("FROM tenant_invites WHERE tenant_id")) {
                const [tenantId, now] = args as [string, string];
                const results = invites.filter((i) => i.tenant_id === tenantId && i.accepted_at === null && i.expires_at > now).map(strip);
                return { results: results as T[] };
              }
              throw new Error(`unhandled all(): ${sql}`);
            }
          };
        }
      };
    }
  };
  return { db: db as unknown as D1Database, members, invites };
}

/** Plans keyed by workspace id; anything unlisted is free. */
function setPlans(plans: Record<string, "free" | "pro" | "team">) {
  getEffectivePlan.mockImplementation(async (_db: D1Database, tenantId: string) => plans[tenantId] ?? "free");
}

const now = new Date("2026-09-24T12:00:00Z");

beforeEach(() => {
  getEffectivePlan.mockReset();
  revokeKeysCreatedBy.mockReset();
  revokeKeysCreatedBy.mockResolvedValue(0);
});

describe("resolveTenant", () => {
  it("puts someone with no team in their own workspace, as owner", async () => {
    const { db } = fakeTeamDb();
    expect(await resolveTenant(db, "alice", now)).toEqual({ userId: "alice", tenantId: "alice", role: "owner", pausedTeamId: null });
  });

  it("puts an active member in the team's workspace", async () => {
    const { db, members } = fakeTeamDb();
    members.set("bob", { user_id: "bob", tenant_id: "alice", created_at: "" });
    setPlans({ alice: "team" });
    expect(await resolveTenant(db, "bob", now)).toEqual({ userId: "bob", tenantId: "alice", role: "member", pausedTeamId: null });
  });

  it("sends a member back to their own workspace while the team's plan has lapsed", async () => {
    const { db, members } = fakeTeamDb();
    members.set("bob", { user_id: "bob", tenant_id: "alice", created_at: "" });
    setPlans({ alice: "pro" });
    expect(await resolveTenant(db, "bob", now)).toEqual({ userId: "bob", tenantId: "bob", role: "owner", pausedTeamId: "alice" });
  });
});

describe("invites", () => {
  it("stores only a hash of the token, finds the invite by the plaintext token, and normalizes the email", async () => {
    const { db, invites } = fakeTeamDb();
    const { token } = await createInvite(db, "alice", "  Bob@Example.com ", "alice", now);
    expect(invites[0]!.token_hash).not.toBe(token);
    expect((await getInviteByToken(db, token))?.email).toBe("bob@example.com");
    expect(await getInviteByToken(db, "wrong-token")).toBeNull();
  });

  it("counts the owner, members and pending invites against the seat limit", async () => {
    const { db, members } = fakeTeamDb();
    members.set("bob", { user_id: "bob", tenant_id: "alice", created_at: "" });
    await createInvite(db, "alice", "carol@example.com", "alice", now);
    expect(await seatsUsed(db, "alice", now)).toBe(3);
  });

  it("frees the seat when an invite is withdrawn, and never deletes another workspace's invite", async () => {
    const { db } = fakeTeamDb();
    const { inviteId } = await createInvite(db, "alice", "carol@example.com", "alice", now);
    expect(await revokeInvite(db, "mallory", inviteId)).toBe(false);
    expect(await revokeInvite(db, "alice", inviteId)).toBe(true);
    expect(await listPendingInvites(db, "alice", now)).toEqual([]);
  });
});

describe("checkInvite", () => {
  async function setup() {
    const env = fakeTeamDb();
    const { token } = await createInvite(env.db, "alice", "bob@example.com", "alice", now);
    const invite = await getInviteByToken(env.db, token);
    setPlans({ alice: "team" });
    return { ...env, invite };
  }

  it("accepts the invited person on an active team with a free seat", async () => {
    const { db, invite } = await setup();
    expect(await checkInvite(db, invite, "bob", "BOB@example.com", now)).toBeNull();
  });

  it("refuses a missing, expired, or already-used invite", async () => {
    const { db, invite } = await setup();
    expect(await checkInvite(db, null, "bob", "bob@example.com", now)).toBe("not_found");
    expect(await checkInvite(db, invite, "bob", "bob@example.com", new Date("2026-10-30T00:00:00Z"))).toBe("expired");
    expect(await checkInvite(db, { ...invite!, accepted_at: now.toISOString() }, "bob", "bob@example.com", now)).toBe("already_used");
  });

  it("refuses the owner accepting their own invite", async () => {
    const { db, invite } = await setup();
    expect(await checkInvite(db, invite, "alice", "bob@example.com", now)).toBe("own_team");
  });

  it("refuses anyone signed in with a different email, so a forwarded link can't hand out a seat", async () => {
    const { db, invite } = await setup();
    expect(await checkInvite(db, invite, "mallory", "mallory@example.com", now)).toBe("wrong_email");
    expect(await checkInvite(db, invite, "mallory", null, now)).toBe("wrong_email");
  });

  it("refuses someone already on a team", async () => {
    const { db, invite, members } = await setup();
    members.set("bob", { user_id: "bob", tenant_id: "zed", created_at: "" });
    expect(await checkInvite(db, invite, "bob", "bob@example.com", now)).toBe("already_member");
  });

  it("refuses an owner whose own team still has members, even once its plan has lapsed", async () => {
    const { db, invite, members } = await setup();
    members.set("carol", { user_id: "carol", tenant_id: "bob", created_at: "" });
    expect(await checkInvite(db, invite, "bob", "bob@example.com", now)).toBe("owns_team");
  });

  it("refuses someone paying for their own plan, so nobody pays twice", async () => {
    const { db, invite } = await setup();
    setPlans({ alice: "team", bob: "pro" });
    expect(await checkInvite(db, invite, "bob", "bob@example.com", now)).toBe("has_paid_plan");
  });

  it("refuses when the team's plan isn't Team any more", async () => {
    const { db, invite } = await setup();
    setPlans({ alice: "pro" });
    expect(await checkInvite(db, invite, "bob", "bob@example.com", now)).toBe("team_inactive");
  });

  it("refuses when owner + members already fill every seat", async () => {
    const { db, invite, members } = await setup();
    for (let i = 0; i < TEAM_SEATS - 1; i++) members.set(`m${i}`, { user_id: `m${i}`, tenant_id: "alice", created_at: "" });
    expect(await checkInvite(db, invite, "bob", "bob@example.com", now)).toBe("team_full");
  });
});

describe("acceptInvite", () => {
  it("adds the member and marks the invite used, so it can't be accepted twice", async () => {
    const { db, members } = fakeTeamDb();
    const { token } = await createInvite(db, "alice", "bob@example.com", "alice", now);
    const invite = (await getInviteByToken(db, token))!;

    expect(await acceptInvite(db, invite, "bob", now)).toBe(true);
    expect(members.get("bob")?.tenant_id).toBe("alice");
    expect(await acceptInvite(db, invite, "carol", now)).toBe(false);
    expect(members.has("carol")).toBe(false);
  });

  it("gives the invite back if adding the member fails, so it stays usable", async () => {
    const { db, members, invites } = fakeTeamDb();
    members.set("bob", { user_id: "bob", tenant_id: "zed", created_at: "" });
    const { token } = await createInvite(db, "alice", "bob@example.com", "alice", now);
    const invite = (await getInviteByToken(db, token))!;

    await expect(acceptInvite(db, invite, "bob", now)).rejects.toThrow();
    expect(invites[0]!.accepted_at).toBeNull();
  });
});

describe("removeMember / leaveTeam", () => {
  it("removes the member and revokes every API key they created in that workspace", async () => {
    const { db, members } = fakeTeamDb();
    members.set("bob", { user_id: "bob", tenant_id: "alice", created_at: "" });
    expect(await removeMember(db, "alice", "bob")).toBe(true);
    expect(members.has("bob")).toBe(false);
    expect(revokeKeysCreatedBy).toHaveBeenCalledWith(db, "alice", "bob");
  });

  it("won't remove someone from a workspace they aren't in", async () => {
    const { db, members } = fakeTeamDb();
    members.set("bob", { user_id: "bob", tenant_id: "alice", created_at: "" });
    expect(await removeMember(db, "mallory", "bob")).toBe(false);
    expect(members.has("bob")).toBe(true);
    expect(revokeKeysCreatedBy).not.toHaveBeenCalled();
  });

  it("lets a member leave, with the same key cleanup, and is a no-op for someone on no team", async () => {
    const { db, members } = fakeTeamDb();
    members.set("bob", { user_id: "bob", tenant_id: "alice", created_at: "" });
    expect(await leaveTeam(db, "bob")).toBe(true);
    expect(revokeKeysCreatedBy).toHaveBeenCalledWith(db, "alice", "bob");
    expect(await leaveTeam(db, "alice")).toBe(false);
  });
});
