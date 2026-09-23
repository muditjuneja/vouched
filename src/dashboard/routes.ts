import { Hono } from "hono";
import { authenticateDashboardRequest, getTenantEmail } from "../auth/clerk";
import { checkConnectionState, getValidAccessToken, type ConnectionState } from "../auth/google-oauth";
import { isScopeGroup, SCOPE_GROUPS } from "../auth/oauth-routes";
import { listCostLog } from "../clients/dataforseo/cost-tracker";
import { listProperties, listPropertiesWithDomains, type GA4Property } from "../clients/google/analytics-ga4";
import { listSites, type SearchConsoleSite } from "../clients/google/search-console";
import type { ScopeGroup } from "../db/google-tokens";
import { deleteToken } from "../db/google-tokens";
import { createApiKey, listApiKeys, revokeApiKey } from "../db/mcp-api-keys";
import { getEffectivePlan, getSubscription, getWalletBalance, listWalletLedger } from "../db/subscriptions";
import { getUsage } from "../db/usage-counters";
import { addWebsite, deleteWebsite, getWebsiteById, listWebsites, updateWebsite } from "../db/websites";
import { normalizeDomain } from "../envelope/entities";
import { MONTHLY_QUOTA_USD } from "../billing/quotas";
import { buildDiscoveredProperties, type DiscoveredProperty } from "./discovery";
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
import type { ActionNotice, DashboardUser, DashboardWebsite } from "./types";

const RECONNECT_NUDGE_COOLDOWN_HOURS = 24;

function parseActionNotice(action: string | undefined): ActionNotice | null {
  if (!action) return null;
  switch (action) {
    case "added":
      return { type: "success", message: "Website added and tracking initiated." };
    case "updated":
      return { type: "success", message: "Website settings saved successfully." };
    case "deleted":
      return { type: "warn", message: "Website removed from tracking." };
    case "revoked":
      return { type: "warn", message: "MCP API key was revoked." };
    case "disconnected":
      return { type: "warn", message: "Google account disconnected." };
    default:
      return null;
  }
}

async function getDashboardUser(env: Env, tenantId: string): Promise<DashboardUser> {
  const [email, plan] = await Promise.all([getTenantEmail(env, tenantId), getEffectivePlan(env.DB, tenantId)]);
  return { email, plan, tenantId };
}


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

/**
 * The Add-website drawer's whole reason for existing: what's in the
 * tenant's Google account that isn't tracked here yet, so there's
 * something to click instead of a name/domain form to fill in (see
 * discovery.ts). Best-effort per scope, same as fetchGoogleProperties: a
 * transient Google API failure just means fewer discovered properties
 * this load, never a broken page.
 */
async function discoverProperties(
  env: Env,
  tenantId: string,
  gscState: ConnectionState,
  ga4State: ConnectionState,
  existingDomains: Set<string>
): Promise<DiscoveredProperty[]> {
  const [gscSites, ga4Properties] = await Promise.all([
    gscState === "connected"
      ? getValidAccessToken(env, "webmaster_console", tenantId)
          .then((token) => listSites(token))
          .catch(() => [])
      : Promise.resolve([]),
    ga4State === "connected"
      ? getValidAccessToken(env, "analytics_property", tenantId)
          .then((token) => listPropertiesWithDomains(token))
          .catch(() => [])
      : Promise.resolve([])
  ]);
  return buildDiscoveredProperties(gscSites, ga4Properties, existingDomains);
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
  if (c.req.path === "/logout" || c.req.path === "/dashboard/logout") {
    return next();
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

// Clears session cookies and redirects out to the marketing home page
dashboard.all("/logout", (_c) => {
  const headers = new Headers();

  headers.append("Set-Cookie", "__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
  headers.append("Set-Cookie", "__client_uat=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax");
  headers.append("Location", "/?logged_out=1");
  return new Response(null, { status: 303, headers });
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

  const [websiteRows, sub, usage, recentActivity, email, apiKeys, gscState, ga4State] = await Promise.all([
    listWebsites(env.DB, tenantId),
    getSubscription(env.DB, tenantId),
    getUsage(env.DB, tenantId),
    listCostLog(env, tenantId, { limit: 5 }),
    getTenantEmail(env, tenantId),
    listApiKeys(env.DB, tenantId),
    checkConnectionState(env, "webmaster_console", tenantId),
    checkConnectionState(env, "analytics_property", tenantId)
  ]);
  const plan = await getEffectivePlan(env.DB, tenantId);
  const walletBalanceUsd = await getWalletBalance(env.DB, tenantId);
  const user: DashboardUser = { email, plan, tenantId };
  const workerOrigin = new URL(c.req.url).origin;
  const notice = parseActionNotice(c.req.query("action"));

  return c.html(
    renderOverview({
      user,
      plan,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      usageUsd: usage?.cost_incurred_usd ?? 0,
      quotaUsd: MONTHLY_QUOTA_USD[plan],
      walletBalanceUsd,
      websiteCount: websiteRows.length,
      recentActivity,
      dodoConfigured: hasDodo(env),
      hasDodoCustomer: Boolean(sub?.dodo_customer_id),
      workerOrigin,
      hasApiKeys: apiKeys.length > 0,
      gscConnected: gscState === "connected",
      ga4Connected: ga4State === "connected",
      notice
    })
  );
});

dashboard.get("/websites", async (c) => {
  const tenantId = c.get("tenantId");
  const env = c.env;

  const [websiteRows, user] = await Promise.all([
    listWebsites(env.DB, tenantId),
    getDashboardUser(env, tenantId)
  ]);
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
  const existingDomains = new Set(websiteRows.map((row) => normalizeDomain(row.primary_domain)));
  const discovered = await discoverProperties(env, tenantId, gscState, ga4State, existingDomains);
  const connectedParam = c.req.query("connected");
  const actionParam = c.req.query("action");
  const notice = parseActionNotice(actionParam);

  return c.html(
    renderWebsites({
      user,
      websites,
      googleOAuthConfigured: hasGoogleOAuth(env),
      gscState,
      ga4State,
      discovered,
      justConnected: connectedParam && isScopeGroup(connectedParam) ? connectedParam : null,
      notice
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

  return c.redirect("/dashboard/websites?action=added", 303);
});

dashboard.get("/websites/:websiteId/edit", async (c) => {
  const tenantId = c.get("tenantId");
  const env = c.env;
  const [website, user] = await Promise.all([getWebsiteById(env.DB, c.req.param("websiteId"), tenantId), getDashboardUser(env, tenantId)]);
  if (!website) return c.text("not found", 404);

  const [gscState, ga4State] = await Promise.all([
    checkConnectionState(env, "webmaster_console", tenantId),
    checkConnectionState(env, "analytics_property", tenantId)
  ]);
  const { gscSites, ga4Properties } = await fetchGoogleProperties(env, tenantId, gscState, ga4State);

  return c.html(renderWebsiteEdit({ user, website, gscSites, ga4Properties }));
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

  return c.redirect("/dashboard/websites?action=updated", 303);
});

dashboard.post("/websites/:websiteId/delete", async (c) => {
  const tenantId = c.get("tenantId");
  await deleteWebsite(c.env.DB, c.req.param("websiteId"), tenantId);
  return c.redirect("/dashboard/websites?action=deleted", 303);
});

dashboard.get("/usage", async (c) => {
  const tenantId = c.get("tenantId");
  const beforeParam = c.req.query("before");
  const beforeId = beforeParam ? Number(beforeParam) : undefined;

  const limit = 50;
  const [rows, user, usage] = await Promise.all([
    listCostLog(c.env, tenantId, { limit: limit + 1, beforeId }),
    getDashboardUser(c.env, tenantId),
    getUsage(c.env.DB, tenantId)
  ]);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const lastRow = page[page.length - 1];

  return c.html(
    renderUsage({
      user,
      rows: page,
      nextBeforeId: hasMore && lastRow ? lastRow.id : null,
      totalCalls: page.length,
      periodSpendUsd: usage?.cost_incurred_usd ?? 0,
      quotaUsd: MONTHLY_QUOTA_USD[user.plan]
    })
  );
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
  const user: DashboardUser = { email, plan, tenantId };
  const actionParam = c.req.query("action");
  const notice = parseActionNotice(actionParam);

  return c.html(
    renderBilling({
      user,
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
      prefillEmail: email,
      notice
    })
  );
});

dashboard.get("/settings", async (c) => {
  const tenantId = c.get("tenantId");
  const env = c.env;

  const [apiKeys, email, gsc, ga4, plan] = await Promise.all([
    listApiKeys(env.DB, tenantId),
    getTenantEmail(env, tenantId),
    checkConnectionState(env, "webmaster_console", tenantId),
    checkConnectionState(env, "analytics_property", tenantId),
    getEffectivePlan(env.DB, tenantId)
  ]);
  const user: DashboardUser = { email, plan, tenantId };
  const connectedParam = c.req.query("connected");
  const actionParam = c.req.query("action");
  const notice = parseActionNotice(actionParam);

  return c.html(
    renderSettings({
      user,
      email,
      tenantId,
      plan,
      apiKeys,
      gsc,
      ga4,
      googleOAuthConfigured: hasGoogleOAuth(env),
      justConnected: connectedParam && isScopeGroup(connectedParam) ? connectedParam : null,
      notice
    })
  );
});

dashboard.post("/api-keys", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.parseBody();
  const label = String(body.label ?? "").trim() || undefined;

  const created = await createApiKey(c.env.DB, tenantId, label);
  await notifyApiKeyIssued(c.env, tenantId, label ?? null);
  const workerOrigin = new URL(c.req.url).origin;
  const user = await getDashboardUser(c.env, tenantId);
  return c.html(renderApiKeyCreated(created.plaintext, workerOrigin, user));
});

dashboard.post("/api-keys/:keyId/revoke", async (c) => {
  const tenantId = c.get("tenantId");
  await revokeApiKey(c.env.DB, tenantId, c.req.param("keyId"));
  return c.redirect("/dashboard/settings?action=revoked", 303);
});

dashboard.post("/google/:scopeGroup/disconnect", async (c) => {
  const tenantId = c.get("tenantId");
  const scope = c.req.param("scopeGroup");
  if (!isScopeGroup(scope)) {
    return c.text(`scope must be one of: ${SCOPE_GROUPS.join(", ")}`, 400);
  }
  await deleteToken(c.env.DB, scope, tenantId);
  return c.redirect("/dashboard/settings?action=disconnected", 303);
});


// Every write action above is POST-only; nothing in this app ever links
// to a bare GET on one of these paths. The one thing that can still land
// a GET here is authenticateDashboardRequest's Clerk handshake redirect
// (see its doc comment): a handshake's redirect_url is always the
// original request's URL, and the round trip back from Clerk is always a
// GET, regardless of what the original request's method was. Registered
// last so it only catches whatever the specific routes above didn't.
dashboard.get("*", (c) => c.redirect("/dashboard", 303));
