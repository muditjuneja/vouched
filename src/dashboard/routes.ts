import { Hono } from "hono";
import { verifyClerkSession } from "../auth/clerk";
import { checkConnectionState } from "../auth/google-oauth";
import { createApiKey, listApiKeys, revokeApiKey } from "../db/mcp-api-keys";
import { getEffectivePlan } from "../db/subscriptions";
import { getUsage } from "../db/usage-counters";
import { addWebsite, listWebsites } from "../db/websites";
import { MONTHLY_QUOTA_USD } from "../billing/quotas";
import { hasGoogleOAuth, isCloudMode, type Env } from "../types/env";
import { renderApiKeyCreated, renderDashboard, renderSignInRequired, type DashboardWebsite } from "./pages";

type DashboardEnv = { Bindings: Env; Variables: { tenantId: string } };

export const dashboard = new Hono<DashboardEnv>();

// Every /dashboard/* route needs cloud mode plus a signed-in tenant —
// this is the one place both gates live, rather than repeating them per
// route (matches /billing/checkout and /webhooks/dodo's own guards).
dashboard.use("*", async (c, next) => {
  if (!isCloudMode(c.env)) {
    return c.text("not found", 404);
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

  const websiteRows = await listWebsites(env.DB, tenantId);
  // Same caveat as list_websites the MCP tool: one connection check per
  // scope group, not per site (see getAnyToken's doc comment).
  const [gscState, ga4State] = await Promise.all([
    checkConnectionState(env, "webmaster_console", tenantId),
    checkConnectionState(env, "analytics_property", tenantId)
  ]);
  const websites: DashboardWebsite[] = websiteRows.map((row) => ({
    row,
    gsc: row.gsc_site_url ? gscState : "not_configured",
    ga4: row.ga4_property_id ? ga4State : "not_configured"
  }));

  const plan = await getEffectivePlan(env.DB, tenantId);
  const usage = await getUsage(env.DB, tenantId);
  const apiKeys = await listApiKeys(env.DB, tenantId);

  return c.html(
    renderDashboard({
      websites,
      plan,
      usageUsd: usage?.cost_incurred_usd ?? 0,
      quotaUsd: MONTHLY_QUOTA_USD[plan],
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
  return c.html(renderApiKeyCreated(created.plaintext));
});

dashboard.post("/api-keys/:keyId/revoke", async (c) => {
  const tenantId = c.get("tenantId");
  await revokeApiKey(c.env.DB, tenantId, c.req.param("keyId"));
  return c.redirect("/dashboard", 303);
});
