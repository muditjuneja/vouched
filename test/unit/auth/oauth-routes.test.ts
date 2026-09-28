import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../src/types/env";

const { authenticateBillingRequest, resolveTenant, exchangeCodeForTokens } = vi.hoisted(() => ({
  authenticateBillingRequest: vi.fn(),
  resolveTenant: vi.fn(),
  exchangeCodeForTokens: vi.fn()
}));
vi.mock("../../../src/auth/clerk", () => ({ authenticateBillingRequest }));
vi.mock("../../../src/db/team", () => ({ resolveTenant }));
vi.mock("../../../src/auth/google-oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/auth/google-oauth")>();
  return { ...actual, exchangeCodeForTokens };
});

const { handleOAuthCallback, handleOAuthStart } = await import("../../../src/auth/oauth-routes");

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATASETS: {} as R2Bucket,
    CACHE: {} as KVNamespace,
    MCP_BEARER_TOKEN: "setup-secret",
    GOOGLE_OAUTH_CLIENT_ID: "client-123",
    GOOGLE_OAUTH_CLIENT_SECRET: "secret",
    ...overrides
  };
}

const selfHostEnv = fakeEnv();
const cloudEnv = fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test" });

function signedIn(userId: string) {
  authenticateBillingRequest.mockResolvedValue({ ok: true, session: { userId }, withRefreshedCookies: (r: Response) => r });
}

/** Runs /oauth/google/start and returns the nonce it put in state plus the cookie it set. */
async function start(env: Env, query: string): Promise<{ state: string; cookie: string }> {
  const res = await handleOAuthStart(new Request(`https://worker.example/oauth/google/start?${query}`), env);
  expect(res.status).toBe(302);
  const state = new URL(res.headers.get("Location")!).searchParams.get("state")!;
  const setCookie = res.headers.get("Set-Cookie")!;
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("Secure");
  expect(setCookie).toContain("SameSite=Lax");
  return { state, cookie: setCookie.split(";")[0]! };
}

function callback(state: string, cookie?: string): Request {
  const url = `https://worker.example/oauth/google/callback?code=abc&state=${encodeURIComponent(state)}`;
  return new Request(url, { headers: cookie ? { Cookie: cookie } : {} });
}

beforeEach(() => {
  vi.clearAllMocks();
  exchangeCodeForTokens.mockResolvedValue(undefined);
});

describe("Google connect flow (self-host)", () => {
  it("still requires the setup token to start", async () => {
    const res = await handleOAuthStart(new Request("https://worker.example/oauth/google/start?scope=webmaster_console"), selfHostEnv);
    expect(res.status).toBe(401);
  });

  it("completes when the callback comes back to the browser that started it, and clears the cookie", async () => {
    const { state, cookie } = await start(selfHostEnv, "scope=webmaster_console&setup_token=setup-secret");
    const res = await handleOAuthCallback(callback(state, cookie), selfHostEnv);
    expect(res.status).toBe(200);
    expect(exchangeCodeForTokens).toHaveBeenCalledWith(selfHostEnv, "abc", "https://worker.example/oauth/google/callback", "webmaster_console", null);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("refuses a callback with no state cookie: someone else's consent can't connect their Google account", async () => {
    const { state } = await start(selfHostEnv, "scope=webmaster_console&setup_token=setup-secret");
    const res = await handleOAuthCallback(callback(state), selfHostEnv);
    expect(res.status).toBe(400);
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("refuses a state whose nonce doesn't match this browser's cookie", async () => {
    const { cookie } = await start(selfHostEnv, "scope=webmaster_console&setup_token=setup-secret");
    const res = await handleOAuthCallback(callback("webmaster_console:settings:forged", cookie), selfHostEnv);
    expect(res.status).toBe(400);
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("refuses the old bare-scope state", async () => {
    const res = await handleOAuthCallback(callback("webmaster_console"), selfHostEnv);
    expect(res.status).toBe(400);
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });
});

describe("Google connect flow (cloud mode)", () => {
  it("stores the tokens for the signed-in user's workspace and returns to the page they started from", async () => {
    signedIn("user_1");
    resolveTenant.mockResolvedValue({ userId: "user_1", tenantId: "team_owner", role: "member", pausedTeamId: null });
    const { state, cookie } = await start(cloudEnv, "scope=analytics_property&returnTo=websites");
    expect(state).not.toContain("user_1");

    const res = await handleOAuthCallback(callback(state, cookie), cloudEnv);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://worker.example/dashboard/websites?connected=analytics_property");
    expect(exchangeCodeForTokens).toHaveBeenCalledWith(cloudEnv, "abc", "https://worker.example/oauth/google/callback", "analytics_property", "team_owner");
  });

  it("ignores a tenant id smuggled into state: the old attack of sending a victim a consent link for the attacker's workspace", async () => {
    signedIn("victim");
    resolveTenant.mockResolvedValue({ userId: "victim", tenantId: "victim", role: "owner", pausedTeamId: null });
    const res = await handleOAuthCallback(callback("webmaster_console:attacker:settings"), cloudEnv);
    expect(res.status).toBe(400);
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("refuses a callback URL replayed into another signed-in browser (no matching cookie there)", async () => {
    signedIn("attacker");
    resolveTenant.mockResolvedValue({ userId: "attacker", tenantId: "attacker", role: "owner", pausedTeamId: null });
    const { state } = await start(cloudEnv, "scope=webmaster_console");

    signedIn("victim");
    const res = await handleOAuthCallback(callback(state, "__Host-google_oauth_state=victims-own-nonce"), cloudEnv);
    expect(res.status).toBe(400);
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("requires a session at the callback too", async () => {
    signedIn("user_1");
    const { state, cookie } = await start(cloudEnv, "scope=webmaster_console");
    authenticateBillingRequest.mockResolvedValue({ ok: false, response: new Response("unauthorized: sign in first", { status: 401 }) });
    const res = await handleOAuthCallback(callback(state, cookie), cloudEnv);
    expect(res.status).toBe(401);
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });
});
