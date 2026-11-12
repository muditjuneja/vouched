import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../src/types/env";

const m = vi.hoisted(() => ({
  getOnboardingState: vi.fn(),
  recordSignup: vi.fn(),
  recordFirstClient: vi.fn(),
  getEffectivePlan: vi.fn(async (_db: unknown, _tenantId: string): Promise<string> => "free"),
  sendAdminAlert: vi.fn(async () => {}),
  notifyWelcome: vi.fn(async () => true),
  resolveTenant: vi.fn(async (_db: unknown, userId: string) => ({ userId, tenantId: userId, role: "owner", pausedTeamId: null })),
  sendOnce: vi.fn(async (_db: unknown, _t: string, _k: string, send: () => Promise<boolean>) => send())
}));
vi.mock("../../../src/db/signups", () => ({
  getOnboardingState: m.getOnboardingState,
  recordSignup: m.recordSignup,
  recordFirstClient: m.recordFirstClient
}));
vi.mock("../../../src/db/subscriptions", () => ({ getEffectivePlan: m.getEffectivePlan }));
vi.mock("../../../src/db/team", () => ({ resolveTenant: m.resolveTenant }));
vi.mock("../../../src/lib/alerts", () => ({ sendAdminAlert: m.sendAdminAlert }));
vi.mock("../../../src/email/notifications", () => ({ notifyWelcome: m.notifyWelcome }));
vi.mock("../../../src/email/dedup", () => ({ sendOnce: m.sendOnce }));

import { cleanClientName, onboardUser } from "../../../src/email/welcome";

const env = { DB: {}, XMIT_API_KEY: "k" } as unknown as Env;

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockClear();
  m.recordSignup.mockResolvedValue(true);
  m.recordFirstClient.mockResolvedValue(true);
});

describe("onboardUser", () => {
  it("does nothing beyond one read for a known, welcomed user with no new client", async () => {
    m.getOnboardingState.mockResolvedValueOnce({ known: true, welcomed: true, hasClient: false });
    await onboardUser(env, "user_1", { source: "dashboard" });
    expect(m.recordSignup).not.toHaveBeenCalled();
    expect(m.notifyWelcome).not.toHaveBeenCalled();
  });

  it("records a brand-new signup from the webhook with Clerk's timestamp, alerts, and sends the generic welcome", async () => {
    m.getOnboardingState.mockResolvedValueOnce({ known: false, welcomed: false, hasClient: false });
    await onboardUser(env, "user_1", { source: "clerk_webhook", signedUpAt: "2026-11-01T19:14:00.000Z" });
    expect(m.recordSignup).toHaveBeenCalledWith(env.DB, "user_1", "clerk_webhook", "2026-11-01T19:14:00.000Z");
    expect(m.sendAdminAlert).toHaveBeenCalledWith(env, expect.stringContaining("New signup: user_1"));
    expect(m.sendOnce).toHaveBeenCalledWith(env.DB, "user_1", "welcome", expect.any(Function));
    expect(m.notifyWelcome).toHaveBeenCalledWith(env, "user_1", { clientName: undefined, plan: "free" });
  });

  it("welcomes someone who signs up inside an MCP client by name, and records that client", async () => {
    m.getOnboardingState.mockResolvedValueOnce({ known: false, welcomed: false, hasClient: false });
    await onboardUser(env, "user_1", { source: "mcp_authorize", clientName: "Cursor" });
    expect(m.recordFirstClient).toHaveBeenCalledWith(env.DB, "user_1", "Cursor", expect.any(String));
    expect(m.notifyWelcome).toHaveBeenCalledWith(env, "user_1", { clientName: "Cursor", plan: "free" });
    // One alert (the signup, naming the client), not a second "first client" one.
    expect(m.sendAdminAlert).toHaveBeenCalledOnce();
    expect(m.sendAdminAlert).toHaveBeenCalledWith(env, expect.stringContaining("Cursor"));
  });

  it("records and alerts on an already-welcomed user's first client, without a second welcome", async () => {
    m.getOnboardingState.mockResolvedValueOnce({ known: true, welcomed: true, hasClient: false });
    m.recordSignup.mockResolvedValueOnce(false);
    await onboardUser(env, "user_1", { source: "mcp_authorize", clientName: "Claude" });
    expect(m.recordFirstClient).toHaveBeenCalled();
    expect(m.sendAdminAlert).toHaveBeenCalledWith(env, "user_1 connected their first MCP client: Claude");
    expect(m.notifyWelcome).not.toHaveBeenCalled();
  });

  it("shows a team member the team's plan, not their idle personal one", async () => {
    m.getOnboardingState.mockResolvedValueOnce({ known: true, welcomed: false, hasClient: false });
    m.resolveTenant.mockResolvedValueOnce({ userId: "user_2", tenantId: "team_owner", role: "member", pausedTeamId: null });
    m.getEffectivePlan.mockImplementationOnce(async (_db: unknown, t: string) => (t === "team_owner" ? "team" : "free"));
    await onboardUser(env, "user_2", { source: "dashboard" });
    expect(m.notifyWelcome).toHaveBeenCalledWith(env, "user_2", { clientName: undefined, plan: "team" });
  });

  it("skips the signup write for a known person when there's no better timestamp to record", async () => {
    m.getOnboardingState.mockResolvedValueOnce({ known: true, welcomed: false, hasClient: false });
    await onboardUser(env, "user_1", { source: "dashboard" });
    expect(m.recordSignup).not.toHaveBeenCalled();
  });

  it("doesn't claim the welcome when email isn't configured, so it still goes out once it is", async () => {
    m.getOnboardingState.mockResolvedValueOnce({ known: false, welcomed: false, hasClient: false });
    await onboardUser({ DB: {} } as unknown as Env, "user_1", { source: "dashboard" });
    expect(m.recordSignup).toHaveBeenCalled();
    expect(m.sendOnce).not.toHaveBeenCalled();
  });

  it("never throws, so a database hiccup can't break a sign-in", async () => {
    m.getOnboardingState.mockRejectedValueOnce(new Error("D1 down"));
    await expect(onboardUser(env, "user_1", { source: "dashboard" })).resolves.toBeUndefined();
  });
});

describe("cleanClientName", () => {
  it("keeps one short line of plain text from a self-reported client name", () => {
    expect(cleanClientName("Cursor")).toBe("Cursor");
    expect(cleanClientName("Evil\r\nBcc: x@y.z")).toBe("EvilBcc: x@y.z");
    expect(cleanClientName("<!channel> hi")).toBe("!channel hi");
    expect(cleanClientName("a".repeat(100))).toHaveLength(60);
    expect(cleanClientName("   ")).toBeUndefined();
    expect(cleanClientName(undefined)).toBeUndefined();
  });
});
