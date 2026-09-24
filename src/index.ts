import { createMcpHandler } from "agents/mcp/server";
import { Hono } from "hono";
import { handleOAuthCallback, handleOAuthStart } from "./auth/oauth-routes";
import { authenticateBillingRequest } from "./auth/clerk";
import { startCheckout, startCustomerPortalSession, startWalletTopup } from "./billing/dodo-client";
import { MIN_TOPUP_USD } from "./billing/quotas";
import { buildDodoWebhookHandler } from "./billing/webhook-handlers";
import { dashboard } from "./dashboard/routes";
import { verifyApiKey } from "./db/mcp-api-keys";
import { getEffectivePlan, getSubscription, type Plan } from "./db/subscriptions";
import { getMembership, resolveTenant } from "./db/team";
import { ConfigError } from "./lib/errors";
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

/**
 * Billing always acts on the signed-in user's own subscription row, so a
 * team member is turned away rather than starting a checkout that would
 * either bill them personally while on someone else's plan or touch the
 * owner's billing.
 */
async function requireWorkspaceOwner(db: D1Database, userId: string): Promise<Response | null> {
  const ctx = await resolveTenant(db, userId);
  if (ctx.role === "owner") return null;
  return new Response("forbidden: only the workspace owner can manage billing", { status: 403 });
}

// Hono carries the whole cloud-facing surface (dashboard, landing/pSEO
// pages, billing webhooks land here in later milestones); it's what
// Dodo Payments' own adapter targets and runs natively on Workers. In
// self-host mode (CLOUD_MODE unset) this is just a thin router in front of
// the same handful of routes as before; behavior is unchanged.
const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.text(HEALTH_BODY));

// Clears session cookies and redirects to landing page
// One sign-out implementation, in the dashboard (it ends the Clerk session,
// not just our cookies). 307 keeps a POST a POST.
app.all("/logout", (c) => c.redirect("/dashboard/logout", 307));

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
  const auth = await authenticateBillingRequest(c.req.raw, c.env);
  if (!auth.ok) return auth.response;
  const notOwner = await requireWorkspaceOwner(c.env.DB, auth.session.userId);
  if (notOwner) return notOwner;
  // A member whose team's plan lapsed is back in their own workspace, but
  // subscribing here would have them paying twice once the team renews.
  if ((await getMembership(c.env.DB, auth.session.userId)) !== null) {
    return c.text("forbidden: you're still a member of a team; leave it from Settings before subscribing yourself", 403);
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
      tenantId: auth.session.userId,
      customerEmail: email,
      returnUrl
    });
    return auth.withRefreshedCookies(c.redirect(checkoutUrl, 302));
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
  const auth = await authenticateBillingRequest(c.req.raw, c.env);
  if (!auth.ok) return auth.response;
  const notOwner = await requireWorkspaceOwner(c.env.DB, auth.session.userId);
  if (notOwner) return notOwner;

  // Paid data (and so the wallet that pays for overage on it) is a
  // subscriber feature: free plans get their own Google data only.
  if ((await getEffectivePlan(c.env.DB, auth.session.userId)) === "free") {
    return c.text("forbidden: wallet top-ups are for Pro and Team subscribers, upgrade first", 403);
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
      tenantId: auth.session.userId,
      customerEmail: email,
      amountUsd: amount,
      returnUrl
    });
    return auth.withRefreshedCookies(c.redirect(checkoutUrl, 302));
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
  const auth = await authenticateBillingRequest(c.req.raw, c.env);
  if (!auth.ok) return auth.response;
  const notOwner = await requireWorkspaceOwner(c.env.DB, auth.session.userId);
  if (notOwner) return notOwner;
  const sub = await getSubscription(c.env.DB, auth.session.userId);
  if (!sub?.dodo_customer_id) {
    return c.text("no billing account on file yet", 404);
  }
  try {
    return auth.withRefreshedCookies(c.redirect(await startCustomerPortalSession(c.env, sub.dodo_customer_id), 302));
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
  let plan: Plan | null = null;

  if (isCloudMode(c.env)) {
    // Cloud mode: a per-tenant issued API key (mcp_api_keys), not the
    // shared bearer token: see src/db/mcp-api-keys.ts's doc comment on
    // why this is a separate mechanism from a Clerk session.
    const header = c.req.raw.headers.get("Authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return c.text("unauthorized", 401, { "WWW-Authenticate": "Bearer" });
    }
    const key = await verifyApiKey(c.env.DB, token);
    if (!key) {
      return c.text("unauthorized", 401, { "WWW-Authenticate": "Bearer" });
    }
    tenantId = key.tenantId;
    // A key a team member created only works while they're still on that
    // team and it's still on the Team plan. Removing a member also deletes
    // their keys; this covers the plan lapsing, where keys aren't deleted
    // because renewal should bring access straight back.
    if (key.createdBy !== key.tenantId) {
      const creator = await resolveTenant(c.env.DB, key.createdBy);
      if (creator.tenantId !== key.tenantId) {
        return c.text("forbidden: this key belongs to a team you're no longer active on", 403);
      }
    }

    plan = await getEffectivePlan(c.env.DB, tenantId);
    const limiter = plan === "free" ? c.env.MCP_RATE_LIMIT_FREE : c.env.MCP_RATE_LIMIT_PAID;
    if (!limiter) {
      return c.text("server misconfigured: /mcp rate limit binding is missing (wrangler.jsonc ratelimits)", 500);
    }
    const { success } = await limiter.limit({ key: tenantId });
    if (!success) {
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
  const handler = createMcpHandler(() => buildMcpServer(c.env, tenantId, plan));
  // Hono types executionCtx with its own (older, simpler) local
  // ExecutionContext interface; @cloudflare/workers-types' current one adds
  // fields (tracing/abort) Hono's doesn't declare. Same real object at
  // runtime either way; this cast bridges the two type declarations.
  return handler(c.req.raw, c.env, c.executionCtx as unknown as ExecutionContext);
});

export default app;
