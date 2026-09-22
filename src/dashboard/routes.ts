import { Hono } from "hono";
import { authenticateDashboardRequest, getTenantEmail } from "../auth/clerk";
import { checkConnectionState, getValidAccessToken, type ConnectionState } from "../auth/google-oauth";
import { isScopeGroup, SCOPE_GROUPS } from "../auth/oauth-routes";
import { listCostLog } from "../clients/dataforseo/cost-tracker";
import { listProperties, type GA4Property } from "../clients/google/analytics-ga4";
import { listSites, type SearchConsoleSite } from "../clients/google/search-console";
import type { ScopeGroup } from "../db/google-tokens";
import { deleteToken } from "../db/google-tokens";
import { createApiKey, listApiKeys, revokeApiKey } from "../db/mcp-api-keys";
import { getEffectivePlan, getSubscription, getWalletBalance, listWalletLedger } from "../db/subscriptions";
import { getUsage } from "../db/usage-counters";
import { addWebsite, deleteWebsite, getWebsiteById, listWebsites, updateWebsite } from "../db/websites";
import { MONTHLY_QUOTA_USD } from "../billing/quotas";
import { markNotifiedOnce, markNotifiedWithCooldown } from "../email/dedup";
import { notifyApiKeyIssued, notifyReconnectRequired, notifyWelcome } from "../email/notifications";
import { ConfigError } from "../lib/errors";
import { hasDodo, hasGoogleOAuth, isCloudMode, type Env } from "../types/env";
import { renderApiKeyCreated } from "./pages/ApiKeyCreatedPage";
import { renderBilling } from "./pages/BillingPage";
import { renderCloudDisabled } from "./pages/CloudDisabledPage";
import { renderOverview } from "./pages/OverviewPage";
import { renderSettings } from "./pages/SettingsPage";
import { renderSignInRequired } from "./pages/SignInRequiredPage";
import { renderUsage } from "./pages/UsagePage";
import { renderWebsiteEdit } from "./pages/WebsiteEditPage";
import { renderWebsites } from "./pages/WebsitesPage";
import type { DashboardWebsite } from "./types";

const RECONNECT_NUDGE_COOLDOWN_HOURS = 24;

/** Fires the reconnect-nudge email at most once per cooldown window per scope group. */
async function maybeNotifyReconnect(env: Env, tenantId: string, scope: ScopeGroup, state: ConnectionState) {
  if (state !== "reconnect_required") return;
  if (await markNotifiedWithCooldown(env.DB, tenantId, `reconnect:${scope}`, RECONNECT_NUDGE_COOLDOWN_HOURS)) {
    await notifyReconnectRequired(env, tenantId, scope);
  }
}

/**
 * Live GSC sites / GA4 properties for the add/edit website forms' real
 * pickers (see WebsitesData's doc comment). Best-effort: a transient
 * Google API failure here should never break the whole page, just fall
 * back to a plain text input for that one field, same as "not connected"
 * already does.
 */
async function fetchGoogleProperties(
  env: Env,
  tenantId: string,
  gscState: ConnectionState,
  ga4State: ConnectionState
): Promise<{ gscSites: SearchConsoleSite[] | null; ga4Properties: GA4Property[] | null }> {
  const [gscSites, ga4Properties] = await Promise.all([
    gscState === "connected"
      ? getValidAccessToken(env, "webmaster_console", tenantId)
          .then((token) => listSites(token))
          .catch(() => null)
      : Promise.resolve(null),
    ga4State === "connected"
      ? getValidAccessToken(env, "analytics_property", tenantId)
          .then((token) => listProperties(token))
          .catch(() => null)
      : Promise.resolve(null)
  ]);
  return { gscSites, ga4Properties };
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
  let auth;
  try {
    auth = await authenticateDashboardRequest(c.req.raw, c.env);
  } catch (error) {
    if (error instanceof ConfigError) return c.text(error.message, 500);
    throw error;
  }
  if (auth.handshakeRedirect) return auth.handshakeRedirect;
  if (!auth.session) {
    return c.html(renderSignInRequired(c.req.url, c.env.CLERK_SIGN_IN_URL ?? null), 401);
  }
  c.set("tenantId", auth.session.userId);
  await next();
  // A stale session token got silently refreshed via authenticateDashboardRequest's
  // GET probe (see its doc comment): carry the refreshed cookies onto whatever
  // response the actual route produced, so the browser's cookie jar picks up the
  // fresher token instead of hitting this same refresh again on the very next request.
  if (auth.refreshedSetCookies.length > 0) {
    const headers = new Headers(c.res.headers);
    for (const cookie of auth.refreshedSetCookies) headers.append("Set-Cookie", cookie);
    c.res = new Response(c.res.body, { status: c.res.status, headers });
  }
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

  const [websiteRows, sub, usage, recentActivity] = await Promise.all([
    listWebsites(env.DB, tenantId),
    getSubscription(env.DB, tenantId),
    getUsage(env.DB, tenantId),
    listCostLog(env, tenantId, { limit: 5 })
  ]);
  const plan = await getEffectivePlan(env.DB, tenantId);
  const walletBalanceUsd = await getWalletBalance(env.DB, tenantId);

  return c.html(
    renderOverview({
      plan,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      usageUsd: usage?.cost_incurred_usd ?? 0,
      quotaUsd: MONTHLY_QUOTA_USD[plan],
      walletBalanceUsd,
      websiteCount: websiteRows.length,
      recentActivity,
      dodoConfigured: hasDodo(env),
      hasDodoCustomer: Boolean(sub?.dodo_customer_id)
    })
  );
});

dashboard.get("/websites", async (c) => {
  const tenantId = c.get("tenantId");
  const env = c.env;

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
  const { gscSites, ga4Properties } = await fetchGoogleProperties(env, tenantId, gscState, ga4State);

  return c.html(renderWebsites({ websites, googleOAuthConfigured: hasGoogleOAuth(env), gscSites, ga4Properties }));
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

  return c.redirect("/dashboard/websites", 303);
});

dashboard.get("/websites/:websiteId/edit", async (c) => {
  const tenantId = c.get("tenantId");
  const env = c.env;
  const website = await getWebsiteById(env.DB, c.req.param("websiteId"), tenantId);
  if (!website) return c.text("not found", 404);

  const [gscState, ga4State] = await Promise.all([
    checkConnectionState(env, "webmaster_console", tenantId),
    checkConnectionState(env, "analytics_property", tenantId)
  ]);
  const { gscSites, ga4Properties } = await fetchGoogleProperties(env, tenantId, gscState, ga4State);

  return c.html(renderWebsiteEdit({ website, gscSites, ga4Properties }));
});

dashboard.post("/websites/:websiteId/update", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.parseBody();
  const name = String(body.name ?? "").trim();
  const primaryDomain = String(body.primaryDomain ?? "").trim();
  const gscSiteUrl = String(body.gscSiteUrl ?? "").trim();
  const ga4PropertyId = String(body.ga4PropertyId ?? "").trim();

  if (!name || !primaryDomain) {
    return c.text("name and primaryDomain are required", 400);
  }

  const updated = await updateWebsite(
    c.env.DB,
    c.req.param("websiteId"),
    {
      name,
      primaryDomain,
      gscSiteUrl: gscSiteUrl || null,
      ga4PropertyId: ga4PropertyId || null
    },
    tenantId
  );
  if (!updated) return c.text("not found", 404);

  return c.redirect("/dashboard/websites", 303);
});

dashboard.post("/websites/:websiteId/delete", async (c) => {
  const tenantId = c.get("tenantId");
  await deleteWebsite(c.env.DB, c.req.param("websiteId"), tenantId);
  return c.redirect("/dashboard/websites", 303);
});

dashboard.get("/usage", async (c) => {
  const tenantId = c.get("tenantId");
  const beforeParam = c.req.query("before");
  const beforeId = beforeParam ? Number(beforeParam) : undefined;

  const limit = 50;
  const rows = await listCostLog(c.env, tenantId, { limit: limit + 1, beforeId });
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const lastRow = page[page.length - 1];

  return c.html(renderUsage({ rows: page, nextBeforeId: hasMore && lastRow ? lastRow.id : null }));
});

dashboard.get("/billing", async (c) => {
  const tenantId = c.get("tenantId");
  const env = c.env;

  const [sub, usage, walletBalanceUsd, walletLedger, email] = await Promise.all([
    getSubscription(env.DB, tenantId),
    getUsage(env.DB, tenantId),
    getWalletBalance(env.DB, tenantId),
    listWalletLedger(env.DB, tenantId),
    getTenantEmail(env, tenantId)
  ]);
  const plan = await getEffectivePlan(env.DB, tenantId);

  return c.html(
    renderBilling({
      plan,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      usageUsd: usage?.cost_incurred_usd ?? 0,
      quotaUsd: MONTHLY_QUOTA_USD[plan],
      walletBalanceUsd,
      walletLedger,
      dodoConfigured: hasDodo(env),
      hasDodoCustomer: Boolean(sub?.dodo_customer_id),
      checkoutSuccess: c.req.query("checkout") === "success",
      topupSuccess: c.req.query("topup") === "success",
      prefillEmail: email
    })
  );
});

dashboard.get("/settings", async (c) => {
  const tenantId = c.get("tenantId");
  const env = c.env;

  const [apiKeys, email, gsc, ga4] = await Promise.all([
    listApiKeys(env.DB, tenantId),
    getTenantEmail(env, tenantId),
    checkConnectionState(env, "webmaster_console", tenantId),
    checkConnectionState(env, "analytics_property", tenantId)
  ]);

  return c.html(
    renderSettings({
      email,
      apiKeys,
      gsc,
      ga4,
      googleOAuthConfigured: hasGoogleOAuth(env)
    })
  );
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
  return c.redirect("/dashboard/settings", 303);
});

dashboard.post("/google/:scopeGroup/disconnect", async (c) => {
  const tenantId = c.get("tenantId");
  const scope = c.req.param("scopeGroup");
  if (!isScopeGroup(scope)) {
    return c.text(`scope must be one of: ${SCOPE_GROUPS.join(", ")}`, 400);
  }
  await deleteToken(c.env.DB, scope, tenantId);
  return c.redirect("/dashboard/settings", 303);
});

// Every write action above is POST-only; nothing in this app ever links
// to a bare GET on one of these paths. The one thing that can still land
// a GET here is authenticateDashboardRequest's Clerk handshake redirect
// (see its doc comment): a handshake's redirect_url is always the
// original request's URL, and the round trip back from Clerk is always a
// GET, regardless of what the original request's method was. Registered
// last so it only catches whatever the specific routes above didn't.
dashboard.get("*", (c) => c.redirect("/dashboard", 303));
