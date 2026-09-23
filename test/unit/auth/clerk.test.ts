import type { createClerkClient } from "@clerk/backend";
import { describe, expect, it, vi } from "vitest";
import { authenticateBillingRequest, authenticateDashboardRequest, extractSessionToken, getTenantEmail } from "../../../src/auth/clerk";
import { ConfigError } from "../../../src/lib/errors";
import type { Env } from "../../../src/types/env";

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATASETS: {} as R2Bucket,
    CACHE: {} as KVNamespace,
    MCP_BEARER_TOKEN: "x",
    CLERK_SECRET_KEY: "sk_test",
    ...overrides
  };
}

/** Minimal stand-in for ClerkClient, just enough of .users.getUser's result shape for getTenantEmail to read. */
function fakeClerkClient(
  user: { primaryEmailAddressId: string | null; emailAddresses: { id: string; emailAddress: string }[] } | null
): typeof createClerkClient {
  return (() => ({
    users: {
      async getUser() {
        if (!user) throw new Error("not found");
        return user;
      }
    }
  })) as unknown as typeof createClerkClient;
}

describe("extractSessionToken", () => {
  it("prefers an Authorization: Bearer header over any cookie", () => {
    const req = new Request("https://example.com/", {
      headers: {
        Authorization: "Bearer header-token",
        Cookie: "__session=cookie-token"
      }
    });
    expect(extractSessionToken(req)).toBe("header-token");
  });

  it("falls back to the __session cookie when there's no Authorization header", () => {
    const req = new Request("https://example.com/", {
      headers: { Cookie: "other=1; __session=cookie-token; more=2" }
    });
    expect(extractSessionToken(req)).toBe("cookie-token");
  });

  it("returns null when neither is present", () => {
    const req = new Request("https://example.com/");
    expect(extractSessionToken(req)).toBeNull();
  });

  it("ignores a non-Bearer Authorization header and still checks the cookie", () => {
    const req = new Request("https://example.com/", {
      headers: {
        Authorization: "Basic dXNlcjpwYXNz",
        Cookie: "__session=cookie-token"
      }
    });
    expect(extractSessionToken(req)).toBe("cookie-token");
  });
});

describe("getTenantEmail", () => {
  it("returns the primary email address when one is set", async () => {
    const makeClient = fakeClerkClient({
      primaryEmailAddressId: "idn_2",
      emailAddresses: [
        { id: "idn_1", emailAddress: "old@example.com" },
        { id: "idn_2", emailAddress: "primary@example.com" }
      ]
    });
    expect(await getTenantEmail(fakeEnv(), "user_1", makeClient)).toBe("primary@example.com");
  });

  it("falls back to the first email address when there's no primary match", async () => {
    const makeClient = fakeClerkClient({
      primaryEmailAddressId: null,
      emailAddresses: [{ id: "idn_1", emailAddress: "only@example.com" }]
    });
    expect(await getTenantEmail(fakeEnv(), "user_1", makeClient)).toBe("only@example.com");
  });

  it("returns null when the user has no email addresses at all", async () => {
    const makeClient = fakeClerkClient({ primaryEmailAddressId: null, emailAddresses: [] });
    expect(await getTenantEmail(fakeEnv(), "user_1", makeClient)).toBeNull();
  });

  it("returns null, never throws, when the lookup itself fails", async () => {
    const makeClient = fakeClerkClient(null);
    await expect(getTenantEmail(fakeEnv(), "user_1", makeClient)).resolves.toBeNull();
  });
});

/**
 * Minimal stand-in for ClerkClient, just enough of .authenticateRequest's
 * result shape for authenticateDashboardRequest to read. Takes a function
 * of the request rather than a fixed value, since authenticateDashboardRequest
 * can call authenticateRequest twice (the real request, then a same-cookie
 * GET probe when the first comes back signed-out for a non-GET request) and
 * tests need to tell those two calls apart by method.
 */
function fakeAuthClerkClient(resolve: (request: Request) => unknown): typeof createClerkClient {
  return (() => ({
    authenticateRequest: async (request: Request) => resolve(request)
  })) as unknown as typeof createClerkClient;
}

describe("authenticateDashboardRequest", () => {
  const req = new Request("https://example.com/dashboard");

  it("throws a ConfigError when CLERK_PUBLISHABLE_KEY is missing, before ever touching a Clerk client", async () => {
    await expect(authenticateDashboardRequest(req, fakeEnv({ CLERK_PUBLISHABLE_KEY: undefined }))).rejects.toThrow(ConfigError);
  });

  it("returns the session's userId when Clerk reports signed-in, with no cookies to forward on a routine already-valid session", async () => {
    const makeClient = fakeAuthClerkClient(() => ({ status: "signed-in", toAuth: () => ({ userId: "user_1" }), headers: new Headers() }));
    const result = await authenticateDashboardRequest(req, fakeEnv({ CLERK_PUBLISHABLE_KEY: "pk_test" }), makeClient);
    expect(result.session).toEqual({ userId: "user_1" });
    expect(result.handshakeRedirect).toBeNull();
    expect(result.refreshedSetCookies).toEqual([]);
  });

  it("forwards fresh Set-Cookie headers when the signed-in status came from resolving a __clerk_handshake token", async () => {
    const resolvedHeaders = new Headers();
    resolvedHeaders.append("Set-Cookie", "__session=resolved-token; Path=/");
    resolvedHeaders.append("Set-Cookie", "__client_uat=1790022578; Path=/");
    const handshakeReq = new Request("https://example.com/dashboard/websites?__clerk_handshake=some-token");
    const makeClient = fakeAuthClerkClient(() => ({ status: "signed-in", toAuth: () => ({ userId: "user_1" }), headers: resolvedHeaders }));
    const result = await authenticateDashboardRequest(handshakeReq, fakeEnv({ CLERK_PUBLISHABLE_KEY: "pk_test" }), makeClient);
    expect(result.session).toEqual({ userId: "user_1" });
    expect(result.refreshedSetCookies).toEqual(["__session=resolved-token; Path=/", "__client_uat=1790022578; Path=/"]);
  });

  it("returns null session, no redirect, when Clerk reports signed-out on a GET (nothing eligible to retry)", async () => {
    const makeClient = fakeAuthClerkClient(() => ({ status: "signed-out" }));
    const result = await authenticateDashboardRequest(req, fakeEnv({ CLERK_PUBLISHABLE_KEY: "pk_test" }), makeClient);
    expect(result.session).toBeNull();
    expect(result.handshakeRedirect).toBeNull();
    expect(result.refreshedSetCookies).toEqual([]);
  });

  it("returns the handshake's redirect headers verbatim when Clerk reports a handshake is needed", async () => {
    const handshakeHeaders = new Headers({ Location: "https://clerk.example.com/handshake" });
    const makeClient = fakeAuthClerkClient(() => ({ status: "handshake", headers: handshakeHeaders }));
    const result = await authenticateDashboardRequest(req, fakeEnv({ CLERK_PUBLISHABLE_KEY: "pk_test" }), makeClient);
    expect(result.session).toBeNull();
    expect(result.handshakeRedirect).toBeInstanceOf(Response);
    expect(result.handshakeRedirect?.status).toBe(303);
    expect(result.handshakeRedirect?.headers.get("Location")).toBe("https://clerk.example.com/handshake");
  });

  describe("a form POST whose session token has gone stale", () => {
    const postReq = new Request("https://example.com/dashboard/websites", {
      method: "POST",
      headers: { Cookie: "__session=stale-token" }
    });

    it("silently refreshes via a same-cookie GET probe and carries the refreshed cookies back", async () => {
      const refreshedCookies = new Headers();
      refreshedCookies.append("Set-Cookie", "__session=fresh-token; Path=/");
      const makeClient = fakeAuthClerkClient((request) => {
        if (request.method === "GET") {
          return { status: "signed-in", toAuth: () => ({ userId: "user_1" }), headers: refreshedCookies };
        }
        return { status: "signed-out" };
      });

      const result = await authenticateDashboardRequest(postReq, fakeEnv({ CLERK_PUBLISHABLE_KEY: "pk_test" }), makeClient);
      expect(result.session).toEqual({ userId: "user_1" });
      expect(result.handshakeRedirect).toBeNull();
      expect(result.refreshedSetCookies).toEqual(["__session=fresh-token; Path=/"]);
    });

    it("gives up and reports signed-out when the probe can't refresh either (no valid session at all)", async () => {
      const makeClient = fakeAuthClerkClient(() => ({ status: "signed-out" }));
      const result = await authenticateDashboardRequest(postReq, fakeEnv({ CLERK_PUBLISHABLE_KEY: "pk_test" }), makeClient);
      expect(result.session).toBeNull();
      expect(result.refreshedSetCookies).toEqual([]);
    });

    it("falls back to a real handshake redirect when a same-request refresh alone isn't enough, using 303 so the browser's follow-up GETs Clerk instead of replaying the original POST onto it", async () => {
      const handshakeHeaders = new Headers({ Location: "https://clerk.example.com/handshake?redirect_url=%2Fdashboard%2Fwebsites" });
      const makeClient = fakeAuthClerkClient((request) => {
        if (request.method === "GET") return { status: "handshake", headers: handshakeHeaders };
        return { status: "signed-out" };
      });

      const result = await authenticateDashboardRequest(postReq, fakeEnv({ CLERK_PUBLISHABLE_KEY: "pk_test" }), makeClient);
      expect(result.session).toBeNull();
      expect(result.handshakeRedirect).toBeInstanceOf(Response);
      expect(result.handshakeRedirect?.status).toBe(303);
      expect(result.handshakeRedirect?.headers.get("Location")).toContain("dashboard%2Fwebsites");
    });

    it("never retries a POST that was already signed-in on the first check", async () => {
      const authenticateRequest = vi.fn(async () => ({ status: "signed-in", toAuth: () => ({ userId: "user_1" }), headers: new Headers() }));
      const makeClient = (() => ({ authenticateRequest })) as unknown as typeof createClerkClient;
      await authenticateDashboardRequest(postReq, fakeEnv({ CLERK_PUBLISHABLE_KEY: "pk_test" }), makeClient);
      expect(authenticateRequest).toHaveBeenCalledTimes(1);
    });
  });
});

describe("authenticateBillingRequest", () => {
  // The bug this exists to fix: /billing/checkout, /billing/topup, and
  // /billing/portal used to call the bare verifyClerkSession (only checks
  // an already-valid token, no refresh/handshake), so a token due for its
  // silent refresh 401'd on these routes even with a genuinely signed-in
  // browser session. This wraps authenticateDashboardRequest instead, the
  // same machinery the dashboard's own gate uses.
  const req = new Request("https://example.com/billing/checkout?plan=pro");

  it("surfaces a ConfigError as a 500 response instead of throwing", async () => {
    const result = await authenticateBillingRequest(req, fakeEnv({ CLERK_PUBLISHABLE_KEY: undefined }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(500);
      expect(await result.response.text()).toContain("CLERK_PUBLISHABLE_KEY");
    }
  });

  it("passes a handshake redirect through as the response, not a 401", async () => {
    const handshakeHeaders = new Headers({ Location: "https://clerk.example.com/handshake" });
    const makeClient = fakeAuthClerkClient(() => ({ status: "handshake", headers: handshakeHeaders }));
    const result = await authenticateBillingRequest(req, fakeEnv({ CLERK_PUBLISHABLE_KEY: "pk_test" }), makeClient);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(303);
      expect(result.response.headers.get("Location")).toBe("https://clerk.example.com/handshake");
    }
  });

  it("returns a 401 response (not a thrown error) when there's no session at all", async () => {
    const makeClient = fakeAuthClerkClient(() => ({ status: "signed-out" }));
    const result = await authenticateBillingRequest(req, fakeEnv({ CLERK_PUBLISHABLE_KEY: "pk_test" }), makeClient);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(await result.response.text()).toContain("sign in first");
    }
  });

  it("returns the session on success, with a no-op withRefreshedCookies when nothing needed refreshing", async () => {
    const makeClient = fakeAuthClerkClient(() => ({ status: "signed-in", toAuth: () => ({ userId: "user_1" }), headers: new Headers() }));
    const result = await authenticateBillingRequest(req, fakeEnv({ CLERK_PUBLISHABLE_KEY: "pk_test" }), makeClient);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session).toEqual({ userId: "user_1" });
      const original = new Response("hi", { status: 200 });
      expect(result.withRefreshedCookies(original)).toBe(original);
    }
  });

  it("appends a silently-refreshed session cookie onto whatever response the route builds", async () => {
    const refreshedCookies = new Headers();
    refreshedCookies.append("Set-Cookie", "__session=fresh-token; Path=/");
    const postReq = new Request("https://example.com/billing/checkout?plan=pro", { method: "POST" });
    const makeClient = fakeAuthClerkClient((request) => {
      if (request.method === "GET") return { status: "signed-in", toAuth: () => ({ userId: "user_1" }), headers: refreshedCookies };
      return { status: "signed-out" };
    });
    const result = await authenticateBillingRequest(postReq, fakeEnv({ CLERK_PUBLISHABLE_KEY: "pk_test" }), makeClient);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const wrapped = result.withRefreshedCookies(new Response(null, { status: 302, headers: { Location: "https://checkout.example" } }));
      expect(wrapped.headers.get("Set-Cookie")).toBe("__session=fresh-token; Path=/");
      expect(wrapped.headers.get("Location")).toBe("https://checkout.example");
    }
  });
});
