import { describe, expect, it, vi } from "vitest";
import { ConfigError } from "../../../src/lib/errors";
import type { Env } from "../../../src/types/env";

// Only the gate behavior in dashboard.use("*", ...) is covered here; it
// runs before any D1 access, so it's testable without a real D1 binding
// (unavailable in this sandbox, see README). The routes behind the gate
// (listing websites, creating API keys, etc.) touch D1 and are exercised
// under @cloudflare/vitest-pool-workers instead.
//
// authenticateDashboardRequest itself (the real Clerk-handshake logic) is
// unit-tested directly in test/unit/auth/clerk.test.ts; here it's mocked
// so this file can drive the gate through each of its three outcomes
// (signed-in, signed-out, handshake-redirect) without a real Clerk client.
const { authenticateDashboardRequest } = vi.hoisted(() => ({ authenticateDashboardRequest: vi.fn() }));
// Spreads the real module (email/notifications.ts, also pulled in by this
// router, needs the real getTenantEmail) and only overrides the one
// function this file actually drives scenarios through.
vi.mock("../../../src/auth/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/auth/clerk")>();
  return { ...actual, authenticateDashboardRequest };
});

// The gate resolves the signed-in user to a workspace via D1 (src/db/team.ts,
// tested on its own in test/unit/db/team.test.ts). Here every user is simply
// the owner of their own workspace.
vi.mock("../../../src/db/team", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/db/team")>();
  return {
    ...actual,
    resolveTenant: vi.fn(async (_db: D1Database, userId: string) => ({ userId, tenantId: userId, role: "owner", pausedTeamId: null }))
  };
});

import { dashboard } from "../../../src/dashboard/routes";

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATASETS: {} as R2Bucket,
    CACHE: {} as KVNamespace,
    MCP_BEARER_TOKEN: "x",
    ...overrides
  };
}

describe("dashboard gate", () => {
  it("404s entirely outside cloud mode, before ever checking for a session", async () => {
    const res = await dashboard.request("/", {}, fakeEnv());
    expect(res.status).toBe(404);
    expect(authenticateDashboardRequest).not.toHaveBeenCalled();
  });

  it("requires a Clerk session in cloud mode and offers a sign-in link when configured", async () => {
    authenticateDashboardRequest.mockResolvedValueOnce({ session: null, handshakeRedirect: null, refreshedSetCookies: [] });
    const env = fakeEnv({
      CLOUD_MODE: "1",
      CLERK_SECRET_KEY: "sk_test",
      CLERK_SIGN_IN_URL: "https://accounts.example.com/sign-in"
    });
    const res = await dashboard.request("/", {}, env);
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toContain("accounts.example.com/sign-in");
    expect(body).toContain("redirect_url=");
  });

  it("on a development Clerk instance, passes the dev-browser id to the sign-in page and keeps Clerk's cookies", async () => {
    authenticateDashboardRequest.mockResolvedValueOnce({
      session: null,
      handshakeRedirect: null,
      refreshedSetCookies: ["__clerk_db_jwt=dvb_xyz; Path=/"],
      devBrowserToken: "dvb_xyz"
    });
    const env = fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test", CLERK_SIGN_IN_URL: "https://app.accounts.dev/sign-in" });
    const res = await dashboard.request("/", {}, env);
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("__clerk_db_jwt=dvb_xyz");
    expect(res.headers.getSetCookie()).toEqual(["__clerk_db_jwt=dvb_xyz; Path=/"]);
  });

  it("still 401s without crashing when no sign-in URL is configured", async () => {
    authenticateDashboardRequest.mockResolvedValueOnce({ session: null, handshakeRedirect: null, refreshedSetCookies: [] });
    const env = fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test" });
    const res = await dashboard.request("/", {}, env);
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("No sign-in page is configured");
  });

  it("passes through Clerk's handshake redirect verbatim, right after a sign-in that needs one", async () => {
    const handshakeResponse = new Response(null, { status: 307, headers: { Location: "https://clerk.example.com/handshake" } });
    authenticateDashboardRequest.mockResolvedValueOnce({ session: null, handshakeRedirect: handshakeResponse });
    const env = fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test" });
    const res = await dashboard.request("/", {}, env);
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("https://clerk.example.com/handshake");
  });

  it("surfaces a missing CLERK_PUBLISHABLE_KEY as a real 500, not a silent 401", async () => {
    authenticateDashboardRequest.mockRejectedValueOnce(new ConfigError("Clerk is missing CLERK_PUBLISHABLE_KEY"));
    const env = fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test" });
    const res = await dashboard.request("/", {}, env);
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("CLERK_PUBLISHABLE_KEY");
  });
});

describe("dashboard's catch-all GET fallback", () => {
  // Every write action (POST /websites/:id/update, /websites/:id/delete,
  // /api-keys, /api-keys/:id/revoke, /google/:scope/disconnect) is
  // POST-only, but a completed Clerk handshake redirect always lands back
  // on the original request's URL as a GET (see authenticateDashboardRequest's
  // doc comment); without this fallback, that landing 404s instead of just...
  // landing somewhere sane. Note /dashboard/websites itself is now a real
  // GET page (WebsitesPage), so it's no longer a genuinely-unmatched path
  // to probe this with, a POST-only sub-path is used instead.
  it("redirects an otherwise-unmatched GET under /dashboard back to the dashboard instead of 404ing", async () => {
    authenticateDashboardRequest.mockResolvedValueOnce({ session: { userId: "user_1" }, handshakeRedirect: null, refreshedSetCookies: [] });
    const env = fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test" });
    const res = await dashboard.request("/websites/w1/update", {}, env);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/dashboard");
  });

  it("carries a silently-refreshed session cookie onto that redirect", async () => {
    authenticateDashboardRequest.mockResolvedValueOnce({
      session: { userId: "user_1" },
      handshakeRedirect: null,
      refreshedSetCookies: ["__session=fresh-token; Path=/"]
    });
    const env = fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test" });
    const res = await dashboard.request("/websites/w1/update", {}, env);
    expect(res.headers.get("Set-Cookie")).toBe("__session=fresh-token; Path=/");
  });
});

describe("dashboard logout", () => {
  it("clears session cookies and redirects to marketing page with logged_out param", async () => {
    const env = fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test" });
    const res = await dashboard.request("/logout", { method: "POST" }, env);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/?logged_out=1");
    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.includes("__session="))).toBe(true);
    expect(setCookies.some((c) => c.includes("__client_uat="))).toBe(true);
  });

  it("handles GET request to logout identically", async () => {
    const env = fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test" });
    const res = await dashboard.request("/logout", { method: "GET" }, env);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/?logged_out=1");
  });
});

describe("dashboard website edit route", () => {
  it("redirects GET /websites/:websiteId/edit to /dashboard/websites?edit=:websiteId to open the side drawer", async () => {
    authenticateDashboardRequest.mockResolvedValueOnce({ session: { userId: "user_1" }, handshakeRedirect: null, refreshedSetCookies: [] });
    const env = fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test" });
    const res = await dashboard.request("/websites/w1/edit", {}, env);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/dashboard/websites?edit=w1");
  });
});

