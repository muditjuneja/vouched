import { createMcpHandler } from "agents/mcp/server";
import { Hono } from "hono";
import { handleOAuthCallback, handleOAuthStart } from "./auth/oauth-routes";
import { verifyClerkSession } from "./auth/clerk";
import { startCheckout, startCustomerPortalSession, startWalletTopup } from "./billing/dodo-client";
import { MIN_TOPUP_USD } from "./billing/quotas";
import { buildDodoWebhookHandler } from "./billing/webhook-handlers";
import { dashboard } from "./dashboard/routes";
import { verifyApiKey } from "./db/mcp-api-keys";
import { getSubscription } from "./db/subscriptions";
import { ConfigError } from "./lib/errors";
import { checkAndIncrementRateLimit } from "./lib/rate-limit";
import { marketing } from "./marketing/routes";
import { buildMcpServer } from "./mcp/server";
import { HEALTH_BODY } from "./lib/product";
import { isCloudMode, type Env } from "./types/env";

/** Constant-time string compare: avoids leaking the bearer token via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i]! ^ bufB[i]!;
  }
  return diff === 0;
}

function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get("Authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;
  return timingSafeEqual(token, env.MCP_BEARER_TOKEN);
}

// Hono carries the whole cloud-facing surface (dashboard, landing/pSEO
// pages, billing webhooks land here in later milestones); it's what
// Dodo Payments' own adapter targets and runs natively on Workers. In
// self-host mode (CLOUD_MODE unset) this is just a thin router in front of
// the same handful of routes as before; behavior is unchanged.
const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.text(HEALTH_BODY));

// Clears session cookies and redirects to landing page
app.all("/logout", (_c) => {
  const headers = new Headers();

  headers.append("Set-Cookie", "__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
  headers.append("Set-Cookie", "__client_uat=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax");
  headers.append("Location", "/?logged_out=1");
  return new Response(null, { status: 303, headers });
});

// Landing/pricing/comparison/pSEO pages, see src/marketing/routes.ts. Mounted
// at the root ahead of everything else so it owns "/"; none of its other
// routes (/pricing, /tools/*, /vs/*, /for/*, /sitemap.xml, /robots.txt)
// collide with anything else registered below.
app.route("/", marketing);

// Browser-hit routes for the Google consent flow: outside the MCP
// endpoint's bearer-header gate by necessity (a browser redirect can't
// carry it), so handleOAuthStart enforces its own setup_token check.
app.get("/oauth/google/start", (c) => handleOAuthStart(c.req.raw, c.env));
app.get("/oauth/google/callback", (c) => handleOAuthCallback(c.req.raw, c.env));

// Dodo webhooks: auth is the HMAC signature (Standard Webhooks spec),
// verified inside buildDodoWebhookHandler itself, not a Clerk/bearer check.
app.post("/webhooks/dodo", async (c) => {
  if (!isCloudMode(c.env)) {
    return c.text("not found", 404);
  }
  const handler = buildDodoWebhookHandler(c.env);
  return handler(c);
});

// Starts a plan upgrade. Cloud-mode + Clerk-session-gated, same pattern as
// /oauth/google/start. No dashboard exists yet (M15) to link here from;
// this route works today via a bare URL, the same way the Google-connect
// flow did before one existed.
app.get("/billing/checkout", async (c) => {
  if (!isCloudMode(c.env)) {
    return c.text("not found", 404);
  }
  const session = await verifyClerkSession(c.req.raw, c.env);
  if (!session) {
    return c.text("unauthorized: sign in first", 401);
  }

  const plan = c.req.query("plan");
  const email = c.req.query("email");
  if (plan !== "pro" && plan !== "team") {
    return c.text('plan must be "pro" or "team"', 400);
  }
  if (!email) {
    return c.text("email is required", 400);
  }

  try {
    const returnUrl = new URL("/dashboard/billing?checkout=success", new URL(c.req.url).origin).toString();
    const checkoutUrl = await startCheckout(c.env, {
      plan,
      tenantId: session.userId,
      customerEmail: email,
      returnUrl
    });
    return c.redirect(checkoutUrl, 302);
  } catch (error) {
    if (error instanceof ConfigError) {
      return c.text(error.message, 500);
    }
    throw error;
  }
});

// Starts a prepaid overage wallet top-up. Same cloud-mode + Clerk-session
// gate as /billing/checkout, but a one-time payment, not a subscription:
// see src/billing/dodo-client.ts's startWalletTopup.
app.get("/billing/topup", async (c) => {
  if (!isCloudMode(c.env)) {
    return c.text("not found", 404);
  }
  const session = await verifyClerkSession(c.req.raw, c.env);
  if (!session) {
    return c.text("unauthorized: sign in first", 401);
  }

  const amount = Number(c.req.query("amount"));
  const email = c.req.query("email");
  if (!Number.isFinite(amount) || amount < MIN_TOPUP_USD) {
    return c.text(`amount must be a number of at least $${MIN_TOPUP_USD}`, 400);
  }
  if (!email) {
    return c.text("email is required", 400);
  }

  try {
    const returnUrl = new URL("/dashboard/billing?topup=success", new URL(c.req.url).origin).toString();
    const checkoutUrl = await startWalletTopup(c.env, {
      tenantId: session.userId,
      customerEmail: email,
      amountUsd: amount,
      returnUrl
    });
    return c.redirect(checkoutUrl, 302);
  } catch (error) {
    if (error instanceof ConfigError) {
      return c.text(error.message, 500);
    }
    throw error;
  }
});

// A hosted Dodo customer-portal link for the signed-in tenant's own
// subscription (manage payment method, view invoices, cancel). Never
// trusts a client-supplied customer id, only the tenant's own
// subscriptions row, see startCustomerPortalSession's doc comment for why
// the vendored @dodopayments/hono handler isn't used here instead.
app.get("/billing/portal", async (c) => {
  if (!isCloudMode(c.env)) {
    return c.text("not found", 404);
  }
  const session = await verifyClerkSession(c.req.raw, c.env);
  if (!session) {
    return c.text("unauthorized: sign in first", 401);
  }
  const sub = await getSubscription(c.env.DB, session.userId);
  if (!sub?.dodo_customer_id) {
    return c.text("no billing account on file yet", 404);
  }
  try {
    return c.redirect(await startCustomerPortalSession(c.env, sub.dodo_customer_id), 302);
  } catch (error) {
    if (error instanceof ConfigError) {
      return c.text(error.message, 500);
    }
    throw error;
  }
});

// The dashboard's own middleware handles both the cloud-mode and
// Clerk-session gates, see src/dashboard/routes.ts.
app.route("/dashboard", dashboard);

app.all("/mcp", async (c) => {
  let tenantId: string | null = null;

  if (isCloudMode(c.env)) {
    // Cloud mode: a per-tenant issued API key (mcp_api_keys), not the
    // shared bearer token: see src/db/mcp-api-keys.ts's doc comment on
    // why this is a separate mechanism from a Clerk session.
    const header = c.req.raw.headers.get("Authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return c.text("unauthorized", 401, { "WWW-Authenticate": "Bearer" });
    }
    tenantId = await verifyApiKey(c.env.DB, token);
    if (!tenantId) {
      return c.text("unauthorized", 401, { "WWW-Authenticate": "Bearer" });
    }

    const limit = c.env.RATE_LIMIT_PER_MINUTE ? Number(c.env.RATE_LIMIT_PER_MINUTE) : undefined;
    const withinLimit = await checkAndIncrementRateLimit(c.env.DB, tenantId, limit);
    if (!withinLimit) {
      return c.text("rate limit exceeded, try again in a minute", 429, { "Retry-After": "60" });
    }
  } else {
    if (!c.env.MCP_BEARER_TOKEN) {
      return c.text("server misconfigured: MCP_BEARER_TOKEN is not set", 500);
    }
    if (!isAuthorized(c.req.raw, c.env)) {
      return c.text("unauthorized", 401, { "WWW-Authenticate": "Bearer" });
    }
  }

  // A fresh factory per request, closing over this request's `env`:
  // `McpRequestContext` (what the SDK actually hands the factory) carries
  // no Worker bindings, so this closure is how tool handlers reach D1/R2.
  const handler = createMcpHandler(() => buildMcpServer(c.env, tenantId));
  // Hono types executionCtx with its own (older, simpler) local
  // ExecutionContext interface; @cloudflare/workers-types' current one adds
  // fields (tracing/abort) Hono's doesn't declare. Same real object at
  // runtime either way; this cast bridges the two type declarations.
  return handler(c.req.raw, c.env, c.executionCtx as unknown as ExecutionContext);
});

export default app;
