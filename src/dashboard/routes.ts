import { Hono } from "hono";
import { verifyClerkSession } from "../auth/clerk";
import { checkConnectionState, type ConnectionState } from "../auth/google-oauth";
import type { ScopeGroup } from "../db/google-tokens";
import { createApiKey, listApiKeys, revokeApiKey } from "../db/mcp-api-keys";
import { getEffectivePlan, getWalletBalance } from "../db/subscriptions";
import { getUsage } from "../db/usage-counters";
import { addWebsite, listWebsites } from "../db/websites";
import { MONTHLY_QUOTA_USD } from "../billing/quotas";
import { markNotifiedOnce, markNotifiedWithCooldown } from "../email/dedup";
import { notifyApiKeyIssued, notifyReconnectRequired, notifyWelcome } from "../email/notifications";
import { hasGoogleOAuth, isCloudMode, type Env } from "../types/env";
import { renderApiKeyCreated } from "./pages/ApiKeyCreatedPage";
import { renderCloudDisabled } from "./pages/CloudDisabledPage";
import { renderDashboard } from "./pages/DashboardPage";
import { renderSignInRequired } from "./pages/SignInRequiredPage";
import type { DashboardWebsite } from "./types";

const RECONNECT_NUDGE_COOLDOWN_HOURS = 24;

/** Fires the reconnect-nudge email at most once per cooldown window per scope group. */
async function maybeNotifyReconnect(env: Env, tenantId: string, scope: ScopeGroup, state: ConnectionState) {
  if (state !== "reconnect_required") return;
  if (await markNotifiedWithCooldown(env.DB, tenantId, `reconnect:${scope}`, RECONNECT_NUDGE_COOLDOWN_HOURS)) {
    await notifyReconnectRequired(env, tenantId, scope);
  }
}

type DashboardEnv = { Bindings: Env; Variables: { tenantId: string } };

export const dashboard = new Hono<DashboardEnv>();

// Every /dashboard/* route needs cloud mode plus a signed-in tenant, so
// this is the one place both gates live, rather than repeating them per
// route (matches /billing/checkout and /webhooks/dodo's own guards).
dashboard.use("*", async (c, next) => {
  if (!isCloudMode(c.env)) {
    // Still a 404 (the route genuinely doesn't exist on this deployment),
    // but with a real, on-brand explanation instead of a bare "not found"
    // string, for anyone who lands here directly (a stale bookmark, a
    // search-indexed link) on a self-host deployment. The marketing site
    // itself never links here when cloud mode is off (see
    // src/marketing/routes.ts and src/marketing/components/Nav.tsx); this
    // is only the safety net for a visitor who arrives some other way.
    return c.html(renderCloudDisabled(), 404);
  }
  const session = await verifyClerkSession(c.req.raw, c.env);
  if (!session) {
    return c.html(renderSignInRequired(c.req.url, c.env.CLERK_SIGN_IN_URL ?? null), 401);
  }
  c.set("tenantId", session.userId);
  await next();
});

dashboard.get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const env = c.env;

  // Approximates "signup complete" as "first dashboard visit": no Clerk
  // user.created webhook exists in this build (out of scope to add one
  // just for this welcome email).
  if (await markNotifiedOnce(env.DB, tenantId, "welcome")) {
    await notifyWelcome(env, tenantId);
  }

  const websiteRows = await listWebsites(env.DB, tenantId);
  // Same caveat as list_websites the MCP tool: one connection check per
  // scope group, not per site (see getAnyToken's doc comment).
  const [gscState, ga4State] = await Promise.all([
    checkConnectionState(env, "webmaster_console", tenantId),
    checkConnectionState(env, "analytics_property", tenantId)
  ]);
  await Promise.all([
    maybeNotifyReconnect(env, tenantId, "webmaster_console", gscState),
    maybeNotifyReconnect(env, tenantId, "analytics_property", ga4State)
  ]);
  const websites: DashboardWebsite[] = websiteRows.map((row) => ({
    row,
    gsc: row.gsc_site_url ? gscState : "not_configured",
    ga4: row.ga4_property_id ? ga4State : "not_configured"
  }));

  const plan = await getEffectivePlan(env.DB, tenantId);
  const usage = await getUsage(env.DB, tenantId);
  const apiKeys = await listApiKeys(env.DB, tenantId);
  const walletBalanceUsd = await getWalletBalance(env.DB, tenantId);

  return c.html(
    renderDashboard({
      websites,
      plan,
      usageUsd: usage?.cost_incurred_usd ?? 0,
      quotaUsd: MONTHLY_QUOTA_USD[plan],
      walletBalanceUsd,
      apiKeys,
      googleOAuthConfigured: hasGoogleOAuth(env),
      dodoConfigured: Boolean(env.DODO_API_KEY)
    })
  );
});

dashboard.post("/websites", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.parseBody();
  const name = String(body.name ?? "").trim();
  const primaryDomain = String(body.primaryDomain ?? "").trim();
  const gscSiteUrl = String(body.gscSiteUrl ?? "").trim();
  const ga4PropertyId = String(body.ga4PropertyId ?? "").trim();

  if (!name || !primaryDomain) {
    return c.text("name and primaryDomain are required", 400);
  }

  await addWebsite(
    c.env.DB,
    {
      name,
      primaryDomain,
      gscSiteUrl: gscSiteUrl || undefined,
      ga4PropertyId: ga4PropertyId || undefined
    },
    tenantId
  );

  return c.redirect("/dashboard", 303);
});

dashboard.post("/api-keys", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.parseBody();
  const label = String(body.label ?? "").trim() || undefined;

  const created = await createApiKey(c.env.DB, tenantId, label);
  await notifyApiKeyIssued(c.env, tenantId, label ?? null);
  return c.html(renderApiKeyCreated(created.plaintext));
});

dashboard.post("/api-keys/:keyId/revoke", async (c) => {
  const tenantId = c.get("tenantId");
  await revokeApiKey(c.env.DB, tenantId, c.req.param("keyId"));
  return c.redirect("/dashboard", 303);
});
