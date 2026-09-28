import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/types/env";

const { authenticateBillingRequest, getSubscription, getEffectivePlan, resolveTenant, getMembership, startCheckout, startWalletTopup, startCustomerPortalSession } =
  vi.hoisted(() => ({
    authenticateBillingRequest: vi.fn(),
    getSubscription: vi.fn(),
    getEffectivePlan: vi.fn(),
    resolveTenant: vi.fn(),
    getMembership: vi.fn(),
    startCheckout: vi.fn(),
    startWalletTopup: vi.fn(),
    startCustomerPortalSession: vi.fn()
  }));
vi.mock("../../src/auth/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/auth/clerk")>();
  return { ...actual, authenticateBillingRequest };
});
vi.mock("../../src/db/subscriptions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/db/subscriptions")>();
  return { ...actual, getSubscription, getEffectivePlan };
});
vi.mock("../../src/db/team", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/db/team")>();
  return { ...actual, resolveTenant, getMembership };
});
vi.mock("../../src/billing/dodo-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/billing/dodo-client")>();
  return { ...actual, startCheckout, startWalletTopup, startCustomerPortalSession };
});

const { app, default: worker } = await import("../../src/index");

// Only the routes/paths that don't need real D1/R2 bindings are covered
// here (health checks, the bearer-token gate's rejection paths); a
// successful /mcp call needs a fully bound Env and is exercised under
// @cloudflare/vitest-pool-workers instead (see README's sandbox-limitation
// note for why that suite doesn't run in this sandbox).

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATASETS: {} as R2Bucket,
    CACHE: {} as KVNamespace,
    MCP_BEARER_TOKEN: "correct-token",
    ...overrides
  };
}

describe("Hono app: routes not requiring D1/R2", () => {
  it("GET / serves the marketing landing page", async () => {
    const res = await app.request("/", {}, fakeEnv());
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Vouched");
  });

  it("GET /health reports ok", async () => {
    const res = await app.request("/health", {}, fakeEnv());
    expect(res.status).toBe(200);
  });

  it("/mcp without an Authorization header is unauthorized", async () => {
    const res = await app.request("/mcp", {}, fakeEnv());
    expect(res.status).toBe(401);
  });

  it("/mcp with the wrong bearer token is unauthorized", async () => {
    const res = await app.request(
      "/mcp",
      { headers: { Authorization: "Bearer wrong-token" } },
      fakeEnv()
    );
    expect(res.status).toBe(401);
  });

  it("/mcp is misconfigured (500) when MCP_BEARER_TOKEN isn't set", async () => {
    const res = await app.request(
      "/mcp",
      { headers: { Authorization: "Bearer anything" } },
      fakeEnv({ MCP_BEARER_TOKEN: "" })
    );
    expect(res.status).toBe(500);
  });
});

const cloudEnv = fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test" });

/** Matches authenticateBillingRequest's real "ok" shape: a session plus a passthrough cookie-forwarder (see the "carries refreshed cookies" test below for when it isn't a no-op). */
function signedIn(userId = "user_1", withRefreshedCookies: (r: Response) => Response = (r) => r) {
  return { ok: true as const, session: { userId }, withRefreshedCookies };
}

/** Everyone is the owner of their own workspace unless a test says otherwise. */
function ownWorkspace(userId: string) {
  return { userId, tenantId: userId, role: "owner" as const, pausedTeamId: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveTenant.mockImplementation(async (_db: D1Database, userId: string) => ownWorkspace(userId));
  getEffectivePlan.mockResolvedValue("pro");
  getMembership.mockResolvedValue(null);
});

describe("/billing/checkout", () => {
  it("404s outside cloud mode", async () => {
    const res = await app.request("/billing/checkout?plan=pro&email=a@b.com", {}, fakeEnv());
    expect(res.status).toBe(404);
  });

  it("401s when not signed in", async () => {
    authenticateBillingRequest.mockResolvedValueOnce({ ok: false, response: new Response("unauthorized: sign in first", { status: 401 }) });
    const res = await app.request("/billing/checkout?plan=pro&email=a@b.com", {}, cloudEnv);
    expect(res.status).toBe(401);
  });

  it("passes through a handshake redirect verbatim instead of 401ing a token mid-refresh", async () => {
    const handshakeResponse = new Response(null, { status: 303, headers: { Location: "https://clerk.example.com/handshake" } });
    authenticateBillingRequest.mockResolvedValueOnce({ ok: false, response: handshakeResponse });
    const res = await app.request("/billing/checkout?plan=pro&email=a@b.com", {}, cloudEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("https://clerk.example.com/handshake");
  });

  it("redirects to the checkout URL, pointing the return trip at the new billing page", async () => {
    authenticateBillingRequest.mockResolvedValueOnce(signedIn());
    startCheckout.mockResolvedValueOnce("https://checkout.dodo.example/session_abc");
    const res = await app.request("/billing/checkout?plan=pro&email=a@b.com", {}, cloudEnv);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://checkout.dodo.example/session_abc");
    expect(startCheckout).toHaveBeenCalledWith(
      cloudEnv,
      expect.objectContaining({ plan: "pro", tenantId: "user_1", returnUrl: expect.stringContaining("/dashboard/billing?checkout=success") })
    );
  });

  it("carries a silently-refreshed session cookie onto the checkout redirect", async () => {
    authenticateBillingRequest.mockResolvedValueOnce(
      signedIn("user_1", (r) => {
        const headers = new Headers(r.headers);
        headers.append("Set-Cookie", "__session=fresh-token; Path=/");
        return new Response(r.body, { status: r.status, headers });
      })
    );
    startCheckout.mockResolvedValueOnce("https://checkout.dodo.example/session_abc");
    const res = await app.request("/billing/checkout?plan=pro&email=a@b.com", {}, cloudEnv);
    expect(res.headers.get("Set-Cookie")).toBe("__session=fresh-token; Path=/");
  });
});

describe("/billing/topup", () => {
  it("redirects to the top-up checkout URL, pointing the return trip at the new billing page", async () => {
    authenticateBillingRequest.mockResolvedValueOnce(signedIn());
    startWalletTopup.mockResolvedValueOnce("https://checkout.dodo.example/session_def");
    const res = await app.request("/billing/topup?amount=10&email=a@b.com", {}, cloudEnv);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://checkout.dodo.example/session_def");
    expect(startWalletTopup).toHaveBeenCalledWith(
      cloudEnv,
      expect.objectContaining({ tenantId: "user_1", returnUrl: expect.stringContaining("/dashboard/billing?topup=success") })
    );
  });
});

describe("billing is the workspace owner's alone", () => {
  const member = { userId: "user_2", tenantId: "owner_1", role: "member" as const, pausedTeamId: null };

  it.each([
    ["/billing/checkout?plan=pro&email=a@b.com"],
    ["/billing/topup?amount=10&email=a@b.com"],
    ["/billing/portal"]
  ])("403s a team member on %s without starting anything", async (path) => {
    authenticateBillingRequest.mockResolvedValueOnce(signedIn("user_2"));
    resolveTenant.mockResolvedValueOnce(member);
    const res = await app.request(path, {}, cloudEnv);
    expect(res.status).toBe(403);
    expect(startCheckout).not.toHaveBeenCalled();
    expect(startWalletTopup).not.toHaveBeenCalled();
    expect(startCustomerPortalSession).not.toHaveBeenCalled();
  });

  it("403s checkout for a member whose team lapsed, so they never end up paying twice", async () => {
    authenticateBillingRequest.mockResolvedValueOnce(signedIn("user_2"));
    resolveTenant.mockResolvedValueOnce({ userId: "user_2", tenantId: "user_2", role: "owner", pausedTeamId: "owner_1" });
    getMembership.mockResolvedValueOnce({ tenant_id: "owner_1", created_at: "" });
    const res = await app.request("/billing/checkout?plan=pro&email=a@b.com", {}, cloudEnv);
    expect(res.status).toBe(403);
    expect(startCheckout).not.toHaveBeenCalled();
  });

  it("403s a wallet top-up on the free plan: paid market data needs a subscription first", async () => {
    authenticateBillingRequest.mockResolvedValueOnce(signedIn());
    getEffectivePlan.mockResolvedValueOnce("free");
    const res = await app.request("/billing/topup?amount=10&email=a@b.com", {}, cloudEnv);
    expect(res.status).toBe(403);
    expect(startWalletTopup).not.toHaveBeenCalled();
  });
});

/**
 * In cloud mode the OAuth provider validates the bearer token (an OAuth
 * access token, or an API key through resolveApiKey) and attaches the
 * caller as ctx.props before /mcp runs. These tests hand the app that
 * context directly; the provider itself is exercised further down.
 */
function asCaller(props: unknown): ExecutionContext {
  return { props, waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
}

describe("/mcp with a team member's key", () => {
  const limiter = { limit: vi.fn(async () => ({ success: false })) } as unknown as RateLimit;
  const memberKey = asCaller({ kind: "api_key", tenantId: "owner_1", createdBy: "user_2" });

  it("403s once the creator is no longer active on that team", async () => {
    // Removed, or the team's plan lapsed: they resolve back to their own workspace.
    resolveTenant.mockResolvedValueOnce({ userId: "user_2", tenantId: "user_2", role: "owner", pausedTeamId: "owner_1" });
    const res = await app.request("/mcp", {}, { ...cloudEnv, MCP_RATE_LIMIT_FREE: limiter, MCP_RATE_LIMIT_PAID: limiter }, memberKey);
    expect(res.status).toBe(403);
    expect(getEffectivePlan).not.toHaveBeenCalled();
  });

  it("lets an active member's key through to the team's plan and limiter", async () => {
    resolveTenant.mockResolvedValueOnce({ userId: "user_2", tenantId: "owner_1", role: "member", pausedTeamId: null });
    getEffectivePlan.mockResolvedValueOnce("team");
    const res = await app.request("/mcp", {}, { ...cloudEnv, MCP_RATE_LIMIT_FREE: limiter, MCP_RATE_LIMIT_PAID: limiter }, memberKey);
    // The (denying) limiter is the first thing past the membership check.
    expect(res.status).toBe(429);
    expect(getEffectivePlan).toHaveBeenCalledWith(cloudEnv.DB, "owner_1");
    expect(limiter.limit).toHaveBeenCalledWith({ key: "owner_1" });
  });
});

describe("/mcp with an OAuth sign-in", () => {
  it("acts in the signed-in user's current workspace, resolved on every call", async () => {
    const limiter = { limit: vi.fn(async () => ({ success: false })) } as unknown as RateLimit;
    resolveTenant.mockResolvedValueOnce({ userId: "user_2", tenantId: "owner_1", role: "member", pausedTeamId: null });
    getEffectivePlan.mockResolvedValueOnce("team");
    const res = await app.request("/mcp", {}, { ...cloudEnv, MCP_RATE_LIMIT_FREE: limiter, MCP_RATE_LIMIT_PAID: limiter }, asCaller({ kind: "oauth", userId: "user_2" }));
    expect(res.status).toBe(429);
    expect(resolveTenant).toHaveBeenCalledWith(cloudEnv.DB, "user_2");
    expect(limiter.limit).toHaveBeenCalledWith({ key: "owner_1" });
  });
});

describe("/mcp in cloud mode: per-plan burst limit", () => {
  function fakeLimiter(success: boolean) {
    return { limit: vi.fn(async () => ({ success })) } as unknown as RateLimit & { limit: ReturnType<typeof vi.fn> };
  }
  const ownKey = asCaller({ kind: "api_key", tenantId: "tenant-1", createdBy: "tenant-1" });

  it("uses the free limiter for a free-plan tenant and 429s when it says no", async () => {
    const free = fakeLimiter(false);
    const paid = fakeLimiter(true);
    getEffectivePlan.mockResolvedValueOnce("free");
    const res = await app.request("/mcp", {}, { ...cloudEnv, MCP_RATE_LIMIT_FREE: free, MCP_RATE_LIMIT_PAID: paid }, ownKey);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(free.limit).toHaveBeenCalledWith({ key: "tenant-1" });
    expect(paid.limit).not.toHaveBeenCalled();
  });

  it("uses the paid limiter for a paid-plan tenant", async () => {
    const free = fakeLimiter(true);
    const paid = fakeLimiter(false);
    getEffectivePlan.mockResolvedValueOnce("pro");
    const res = await app.request("/mcp", {}, { ...cloudEnv, MCP_RATE_LIMIT_FREE: free, MCP_RATE_LIMIT_PAID: paid }, ownKey);
    expect(res.status).toBe(429);
    expect(paid.limit).toHaveBeenCalledWith({ key: "tenant-1" });
    expect(free.limit).not.toHaveBeenCalled();
  });

  it("fails closed with a 500, not an unlimited pass, when the binding is missing", async () => {
    getEffectivePlan.mockResolvedValueOnce("free");
    const res = await app.request("/mcp", {}, cloudEnv, ownKey);
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("rate limit binding is missing");
  });

  it("401s, touching nothing, when no caller was attached (the request didn't come through the provider)", async () => {
    const res = await app.request("/mcp", { headers: { Authorization: "Bearer vsm_key" } }, cloudEnv);
    expect(res.status).toBe(401);
    expect(getEffectivePlan).not.toHaveBeenCalled();
  });
});

/** Just enough KV for the provider's discovery and challenge paths. */
function fakeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => void store.set(key, value),
    delete: async (key: string) => void store.delete(key),
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null })
  } as unknown as KVNamespace;
}

describe("the Worker in cloud mode: standard MCP authorization", () => {
  const env = { ...cloudEnv, OAUTH_KV: fakeKv() };
  const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

  it("answers /mcp without a token with the challenge that points clients at sign-in", async () => {
    const res = await worker.fetch(new Request("https://vouchedhq.com/mcp", { method: "POST" }), env, ctx);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain('resource_metadata="https://vouchedhq.com/.well-known/oauth-protected-resource/mcp"');
  });

  it("publishes resource metadata naming this origin as the authorization server", async () => {
    const res = await worker.fetch(new Request("https://vouchedhq.com/.well-known/oauth-protected-resource/mcp"), env, ctx);
    const body = (await res.json()) as { resource: string; authorization_servers: string[] };
    expect(body.resource).toBe("https://vouchedhq.com/mcp");
    expect(body.authorization_servers).toEqual(["https://vouchedhq.com"]);
  });

  it("publishes authorization server metadata with our endpoints, PKCE and client registration", async () => {
    const res = await worker.fetch(new Request("https://vouchedhq.com/.well-known/oauth-authorization-server"), env, ctx);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.authorization_endpoint).toBe("https://vouchedhq.com/authorize");
    expect(body.token_endpoint).toBe("https://vouchedhq.com/oauth/token");
    expect(body.registration_endpoint).toBe("https://vouchedhq.com/oauth/register");
    expect(body.code_challenge_methods_supported).toContain("S256");
  });

  it("still serves every other page through the app", async () => {
    const res = await worker.fetch(new Request("https://vouchedhq.com/health"), env, ctx);
    expect(res.status).toBe(200);
  });

  function register(ip: string): Request {
    return new Request("https://vouchedhq.com/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
      body: JSON.stringify({ client_name: "Test", redirect_uris: ["https://client.example/cb"] })
    });
  }

  it("lets a client register while its IP is under the limit, keyed by that IP", async () => {
    const limiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
    const res = await worker.fetch(register("203.0.113.7"), { ...env, OAUTH_REGISTER_RATE_LIMIT: limiter }, ctx);
    expect(res.status).toBe(201);
    expect(limiter.limit).toHaveBeenCalledWith({ key: "203.0.113.7" });
  });

  it("429s client registration once an IP is over the limit, without storing a client", async () => {
    const kv = fakeKv();
    const put = vi.spyOn(kv, "put");
    const limiter = { limit: vi.fn().mockResolvedValue({ success: false }) };
    const res = await worker.fetch(register("203.0.113.7"), { ...env, OAUTH_KV: kv, OAUTH_REGISTER_RATE_LIMIT: limiter }, ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(((await res.json()) as { error: string }).error).toBe("rate_limited");
    expect(put).not.toHaveBeenCalled();
  });

  it("fails closed when the registration limiter binding is missing", async () => {
    const res = await worker.fetch(register("203.0.113.7"), env, ctx);
    expect(res.status).toBe(500);
  });

  it("doesn't rate-limit anything but registration", async () => {
    const limiter = { limit: vi.fn() };
    await worker.fetch(new Request("https://vouchedhq.com/.well-known/oauth-authorization-server"), { ...env, OAUTH_REGISTER_RATE_LIMIT: limiter }, ctx);
    expect(limiter.limit).not.toHaveBeenCalled();
  });
});

describe("/billing/portal", () => {
  it("404s when the tenant has no Dodo customer id on file yet", async () => {
    authenticateBillingRequest.mockResolvedValueOnce(signedIn());
    getSubscription.mockResolvedValueOnce(null);
    const res = await app.request("/billing/portal", {}, cloudEnv);
    expect(res.status).toBe(404);
  });

  it("redirects to the portal session link for the signed-in tenant's own subscription", async () => {
    authenticateBillingRequest.mockResolvedValueOnce(signedIn());
    getSubscription.mockResolvedValueOnce({ dodo_customer_id: "cus_123" });
    startCustomerPortalSession.mockResolvedValueOnce("https://portal.dodo.example/session_xyz");
    const res = await app.request("/billing/portal", {}, cloudEnv);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://portal.dodo.example/session_xyz");
    expect(startCustomerPortalSession).toHaveBeenCalledWith(cloudEnv, "cus_123");
  });
});
