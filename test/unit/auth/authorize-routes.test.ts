import { AuthorizationError } from "@cloudflare/workers-oauth-provider";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../src/types/env";

const { authenticateDashboardRequest, getTenantEmail, resolveTenant } = vi.hoisted(() => ({
  authenticateDashboardRequest: vi.fn(),
  getTenantEmail: vi.fn(async () => "me@example.com"),
  resolveTenant: vi.fn(async (_db: unknown, userId: string) => ({ userId, tenantId: userId, role: "owner", pausedTeamId: null }))
}));
vi.mock("../../../src/auth/clerk", () => ({ authenticateDashboardRequest, getTenantEmail }));
vi.mock("../../../src/db/team", () => ({ resolveTenant }));

import { authorizeRoutes } from "../../../src/auth/authorize-routes";

const AUTH_REQUEST = {
  responseType: "code",
  clientId: "https://claude.ai/oauth/mcp-client-metadata",
  redirectUri: "https://claude.ai/api/mcp/auth_callback",
  scope: ["mcp"],
  state: "s1"
};

function fakeOAuth(clientName = "Claude") {
  return {
    parseAuthRequest: vi.fn(async () => AUTH_REQUEST),
    lookupClient: vi.fn(async () => ({ clientId: AUTH_REQUEST.clientId, clientName, redirectUris: [AUTH_REQUEST.redirectUri] })),
    beginConsent: vi.fn(async () => ({ handle: "h1", headers: new Headers({ "X-Frame-Options": "DENY" }) })),
    approveConsent: vi.fn(async () => ({ request: AUTH_REQUEST, headers: new Headers() })),
    denyConsent: vi.fn(async () => ({ request: AUTH_REQUEST, redirectTo: "https://claude.ai/api/mcp/auth_callback?error=access_denied", headers: new Headers({ Location: "https://claude.ai/api/mcp/auth_callback?error=access_denied" }) })),
    completeAuthorization: vi.fn(async () => ({ redirectTo: "https://claude.ai/api/mcp/auth_callback?code=c1&state=s1" }))
  };
}

function env(oauth: ReturnType<typeof fakeOAuth> | undefined = fakeOAuth()): Env {
  return {
    DB: {} as D1Database,
    CLOUD_MODE: "1",
    CLERK_SECRET_KEY: "sk_test",
    CLERK_SIGN_IN_URL: "https://accounts.example.com/sign-in",
    OAUTH_PROVIDER: oauth
  } as unknown as Env;
}

const signedIn = { session: { userId: "user_1" }, handshakeRedirect: null, refreshedSetCookies: [] };
const url = "https://vouchedhq.com/authorize?response_type=code&client_id=x&state=s1";

beforeEach(() => {
  authenticateDashboardRequest.mockReset();
});

describe("/authorize", () => {
  it("404s outside cloud mode", async () => {
    const res = await authorizeRoutes.request(url, {}, { ...env(), CLOUD_MODE: undefined } as Env);
    expect(res.status).toBe(404);
  });

  it("sends a signed-out user to sign in, coming back to this exact authorization request", async () => {
    authenticateDashboardRequest.mockResolvedValueOnce({ session: null, handshakeRedirect: null, refreshedSetCookies: [] });
    const res = await authorizeRoutes.request(url, {}, env());
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe("https://accounts.example.com/sign-in");
    expect(location.searchParams.get("redirect_url")).toBe(url);
  });

  it("shows the consent page: the app, where access goes, and the anti-framing headers", async () => {
    authenticateDashboardRequest.mockResolvedValueOnce(signedIn);
    const res = await authorizeRoutes.request(url, {}, env());
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    const body = await res.text();
    expect(body).toContain("Allow Claude to use");
    expect(body).toContain("claude.ai"); // publisher and redirect host
    expect(body).toContain('value="h1"');
  });

  it("escapes a malicious app name, since clients choose it", async () => {
    authenticateDashboardRequest.mockResolvedValueOnce(signedIn);
    const res = await authorizeRoutes.request(url, {}, env(fakeOAuth("<script>alert(1)</script>")));
    expect(await res.text()).not.toContain("<script>alert(1)</script>");
  });

  it("on Allow, issues the grant for the signed-in Clerk user and redirects back to the app", async () => {
    authenticateDashboardRequest.mockResolvedValueOnce(signedIn);
    const oauth = fakeOAuth();
    const res = await authorizeRoutes.request(url, { method: "POST", headers: { Origin: new URL(url).origin }, body: new URLSearchParams({ handle: "h1", decision: "approve" }) }, env(oauth));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://claude.ai/api/mcp/auth_callback?code=c1&state=s1");
    expect(oauth.completeAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1", scope: ["mcp"], props: { kind: "oauth", userId: "user_1" } })
    );
  });

  it("on Deny, redirects back with access_denied and issues nothing", async () => {
    authenticateDashboardRequest.mockResolvedValueOnce(signedIn);
    const oauth = fakeOAuth();
    const res = await authorizeRoutes.request(url, { method: "POST", headers: { Origin: new URL(url).origin }, body: new URLSearchParams({ handle: "h1", decision: "deny" }) }, env(oauth));
    expect(res.headers.get("Location")).toContain("error=access_denied");
    expect(oauth.completeAuthorization).not.toHaveBeenCalled();
  });

  it("refuses an Allow posted from another site, before it even checks the session", async () => {
    const oauth = fakeOAuth();
    const res = await authorizeRoutes.request(
      url,
      { method: "POST", headers: { Origin: "https://evil.example" }, body: new URLSearchParams({ handle: "h1", decision: "approve" }) },
      env(oauth)
    );
    expect(res.status).toBe(403);
    expect(authenticateDashboardRequest).not.toHaveBeenCalled();
    expect(oauth.completeAuthorization).not.toHaveBeenCalled();
  });

  it("shows a bad request on our own page instead of redirecting to an unverified address", async () => {
    authenticateDashboardRequest.mockResolvedValueOnce(signedIn);
    const oauth = fakeOAuth();
    oauth.parseAuthRequest.mockRejectedValueOnce(new AuthorizationError("invalid_request", { description: "Unknown redirect URI" }));
    const res = await authorizeRoutes.request(url, {}, env(oauth));
    expect(res.status).toBe(400);
    expect(res.headers.get("Location")).toBeNull();
    expect(await res.text()).toContain("Unknown redirect URI");
  });
});
