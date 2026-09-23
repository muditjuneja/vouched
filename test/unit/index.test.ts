import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/types/env";

const { authenticateBillingRequest, getSubscription, startCheckout, startWalletTopup, startCustomerPortalSession } = vi.hoisted(() => ({
  authenticateBillingRequest: vi.fn(),
  getSubscription: vi.fn(),
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
  return { ...actual, getSubscription };
});
vi.mock("../../src/billing/dodo-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/billing/dodo-client")>();
  return { ...actual, startCheckout, startWalletTopup, startCustomerPortalSession };
});

const { default: app } = await import("../../src/index");

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

beforeEach(() => {
  vi.clearAllMocks();
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
