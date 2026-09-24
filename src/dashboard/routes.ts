import { Hono } from "hono";
import { authenticateDashboardRequest, getTenantEmail, revokeClerkSession } from "../auth/clerk";
import { checkConnectionState, getValidAccessToken, type ConnectionState } from "../auth/google-oauth";
import { isScopeGroup, SCOPE_GROUPS } from "../auth/oauth-routes";
import { listCostLog } from "../clients/dataforseo/cost-tracker";
import { listPropertiesWithDomains, type GA4Property } from "../clients/google/analytics-ga4";
import { listSites, type SearchConsoleSite } from "../clients/google/search-console";
import type { ScopeGroup } from "../db/google-tokens";
import { deleteToken } from "../db/google-tokens";
import { createApiKey, listApiKeys, revokeApiKey } from "../db/mcp-api-keys";
import { getEffectivePlan, getSubscription, getWalletBalance, listWalletLedger, type Plan } from "../db/subscriptions";
import { getUsage } from "../db/usage-counters";
import {
  acceptInvite,
  checkInvite,
  createInvite,
  getInviteByToken,
  leaveTeam,
  listMembers,
  listPendingInvites,
  normalizeEmail,
  removeMember,
  resolveTenant,
  revokeInvite,
  seatsUsed,
  type TenantContext
} from "../db/team";
import { addWebsite, deleteWebsite, listWebsites, updateWebsite } from "../db/websites";
import { normalizeDomain } from "../envelope/entities";
import { MONTHLY_QUOTA_USD, TEAM_SEATS } from "../billing/quotas";
import { buildDiscoveredProperties, type DiscoveredProperty } from "./discovery";
import { markNotifiedWithCooldown, sendOnce } from "../email/dedup";
import { notifyApiKeyIssued, notifyReconnectRequired, notifyTeamInvite, notifyWelcome } from "../email/notifications";
import { ConfigError } from "../lib/errors";
import { hasDodo, hasGoogleOAuth, isCloudMode, type Env } from "../types/env";
import { renderApiKeyCreated } from "./pages/ApiKeyCreatedPage";
import { renderApiKeys } from "./pages/ApiKeysPage";
import { renderBilling } from "./pages/BillingPage";
import { renderCloudDisabled } from "./pages/CloudDisabledPage";
import { renderInvite } from "./pages/InvitePage";
import { renderOverview } from "./pages/OverviewPage";
import { renderSettings } from "./pages/SettingsPage";
import { renderSignInRequired } from "./pages/SignInRequiredPage";
import { renderUsage } from "./pages/UsagePage";
import { renderWebsites } from "./pages/WebsitesPage";
import type { ActionNotice, DashboardUser, DashboardWebsite, TeamSettings } from "./types";

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
    case "invited":
      return { type: "success", message: "Invite sent." };
    case "already_invited":
      return { type: "info", message: "That address already has a pending invite." };
    case "invite_revoked":
      return { type: "warn", message: "Invite withdrawn." };
    case "member_removed":
      return { type: "warn", message: "Member removed. Their API keys for this workspace no longer work." };
    case "team_full":
      return { type: "warn", message: "All seats are taken." };
    case "not_team":
      return { type: "warn", message: "Inviting people needs the Team plan." };
    case "bad_email":
      return { type: "warn", message: "That doesn't look like an email address." };
    case "left_team":
      return { type: "info", message: "You left the team and are back in your own workspace." };
    case "joined_team":
      return { type: "success", message: "You joined the team. Everything here is now the team's workspace." };
    default:
      return null;
  }
}

/** The signed-in person's own email, with the workspace's plan: a member sees their own address but the team's plan. */
async function getDashboardUser(env: Env, ctx: TenantContext): Promise<DashboardUser> {
  const [email, plan] = await Promise.all([getTenantEmail(env, ctx.userId), getEffectivePlan(env.DB, ctx.tenantId)]);
  return { email, plan, tenantId: ctx.tenantId, role: ctx.role };
}

/**
 * Settings' team section, or null when there's nothing to show (an owner
 * who isn't on Team and has never had members). Members see teammates but
 * not pending invites; only the owner manages seats.
 */
async function loadTeamSettings(env: Env, ctx: TenantContext, plan: Plan): Promise<TeamSettings | null> {
  if (ctx.pausedTeamId) {
    const ownerEmail = await getTenantEmail(env, ctx.pausedTeamId);
    return { role: "member", seatLimit: TEAM_SEATS, ownerEmail, members: [], pendingInvites: [], canInvite: false, pausedTeamOwnerEmail: ownerEmail };
  }
  const members = await listMembers(env.DB, ctx.tenantId);
  if (ctx.role === "owner" && plan !== "team" && members.length === 0) return null;

  const isOwner = ctx.role === "owner";
  const [ownerEmail, memberEmails, pending, used] = await Promise.all([
    getTenantEmail(env, ctx.tenantId),
    Promise.all(members.map((m) => getTenantEmail(env, m.user_id))),
    isOwner ? listPendingInvites(env.DB, ctx.tenantId) : Promise.resolve([]),
    seatsUsed(env.DB, ctx.tenantId)
  ]);
  return {
    role: ctx.role,
    seatLimit: TEAM_SEATS,
    ownerEmail,
    members: members.map((m, i) => ({ userId: m.user_id, email: memberEmails[i] ?? null, joinedAt: m.created_at })),
    pendingInvites: pending.map((inv) => ({ inviteId: inv.invite_id, email: inv.email, expiresAt: inv.expires_at })),
    canInvite: isOwner && plan === "team" && used < TEAM_SEATS,
    pausedTeamOwnerEmail: null
  };
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
          .then((token) => listPropertiesWithDomains(token))
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
): Promise<{
  discovered: DiscoveredProperty[];
  gscSites: SearchConsoleSite[] | null;
  ga4Properties: GA4Property[] | null;
}> {
  const { gscSites, ga4Properties } = await fetchGoogleProperties(env, tenantId, gscState, ga4State);
  const discovered = buildDiscoveredProperties(gscSites ?? [], ga4Properties ?? [], existingDomains);
  return { discovered, gscSites, ga4Properties };
}

type DashboardEnv = { Bindings: Env; Variables: { tenantId: string; ctx: TenantContext } };

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
    const page = c.html(renderSignInRequired(c.req.url, c.env.CLERK_SIGN_IN_URL ?? null, auth.devBrowserToken ?? null), 401);
    for (const cookie of auth.refreshedSetCookies) page.headers.append("Set-Cookie", cookie);
    return page;
  }
  // The signed-in user becomes a workspace here, once: their own, or the
  // team's when they're an active member (see resolveTenant). Every route
  // below scopes to ctx.tenantId; ctx.userId is only for per-person things
  // (their email, their API keys, owner-only checks).
  const ctx = await resolveTenant(c.env.DB, auth.session.userId);
  c.set("ctx", ctx);
  c.set("tenantId", ctx.tenantId);
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

// Signs out for real: ends the Clerk session itself, then clears our
// cookies and goes to the home page. The gate above lets this path through
// unauthenticated, so it identifies the session here. If that needs a
// handshake first, the handshake comes back to this same URL as a GET.
dashboard.all("/logout", async (c) => {
  if (isCloudMode(c.env) && c.env.CLERK_PUBLISHABLE_KEY) {
    const auth = await authenticateDashboardRequest(c.req.raw, c.env);
    if (auth.handshakeRedirect) return auth.handshakeRedirect;
    if (auth.session?.sessionId) await revokeClerkSession(c.env, auth.session.sessionId);
  }

  const expired = "Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax";
  // Clerk also sets __client_uat on the whole domain, which a host-only
  // cookie clear doesn't touch.
  const domain = new URL(c.req.url).hostname;
  const headers = new Headers();
  headers.append("Set-Cookie", `__session=; ${expired}; HttpOnly`);
  headers.append("Set-Cookie", `__client_uat=; ${expired}`);
  headers.append("Set-Cookie", `__client_uat=; Domain=${domain}; ${expired}`);
  headers.append("Location", "/?logged_out=1");
  return new Response(null, { status: 303, headers });
});

dashboard.get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const env = c.env;

  // Approximates "signup complete" as "first dashboard visit": no Clerk
  // user.created webhook exists in this build (out of scope to add one
  // just for this welcome email).
  await sendOnce(env.DB, tenantId, "welcome", () => notifyWelcome(env, tenantId));

  const [websiteRows, sub, usage, recentActivity, email, apiKeys, gscState, ga4State] = await Promise.all([
    listWebsites(env.DB, tenantId),
    getSubscription(env.DB, tenantId),
    getUsage(env.DB, tenantId),
    listCostLog(env, tenantId, { limit: 5 }),
    getTenantEmail(env, c.get("ctx").userId),
    listApiKeys(env.DB, tenantId, c.get("ctx").userId),
    checkConnectionState(env, "webmaster_console", tenantId),
    checkConnectionState(env, "analytics_property", tenantId)
  ]);
  const plan = await getEffectivePlan(env.DB, tenantId);
  const walletBalanceUsd = await getWalletBalance(env.DB, tenantId);
  const user: DashboardUser = { email, plan, tenantId, role: c.get("ctx").role };
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
    getDashboardUser(env, c.get("ctx"))
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
  const { discovered, gscSites, ga4Properties } = await discoverProperties(env, tenantId, gscState, ga4State, existingDomains);
  const connectedParam = c.req.query("connected");
  const actionParam = c.req.query("action");
  const editParam = c.req.query("edit");
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
      notice,
      gscSites,
      ga4Properties,
      editingWebsiteId: editParam ?? null
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

dashboard.get("/websites/:websiteId/edit", (c) => {
  const websiteId = c.req.param("websiteId");
  return c.redirect(`/dashboard/websites?edit=${encodeURIComponent(websiteId)}`, 303);
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
    getDashboardUser(c.env, c.get("ctx")),
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
    getTenantEmail(env, c.get("ctx").userId)
  ]);
  const plan = await getEffectivePlan(env.DB, tenantId);
  const user: DashboardUser = { email, plan, tenantId, role: c.get("ctx").role };
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
      canManageBilling: c.get("ctx").role === "owner",
      notice
    })
  );
});

/**
 * Builds the Settings page. Shared by GET /settings and the invite action,
 * which re-renders it with a one-off notice (the invite link, when email
 * isn't configured) instead of redirecting.
 */
async function settingsHtml(env: Env, ctx: TenantContext, notice: ActionNotice | null, justConnected: string | undefined): Promise<string> {
  const tenantId = ctx.tenantId;
  const [user, gsc, ga4] = await Promise.all([
    getDashboardUser(env, ctx),
    checkConnectionState(env, "webmaster_console", tenantId),
    checkConnectionState(env, "analytics_property", tenantId)
  ]);
  const team = await loadTeamSettings(env, ctx, user.plan);
  return renderSettings({
    user,
    email: user.email,
    tenantId,
    plan: user.plan,
    gsc,
    ga4,
    googleOAuthConfigured: hasGoogleOAuth(env),
    justConnected: justConnected && isScopeGroup(justConnected) ? justConnected : null,
    notice,
    team
  });
}

dashboard.get("/settings", async (c) => {
  return c.html(await settingsHtml(c.env, c.get("ctx"), parseActionNotice(c.req.query("action")), c.req.query("connected")));
});

dashboard.get("/api-keys", async (c) => {
  const ctx = c.get("ctx");
  const [apiKeys, user] = await Promise.all([listApiKeys(c.env.DB, ctx.tenantId, ctx.userId), getDashboardUser(c.env, ctx)]);
  return c.html(
    renderApiKeys({ user, apiKeys, openCreate: c.req.query("new") === "1", notice: parseActionNotice(c.req.query("action")) })
  );
});

dashboard.post("/api-keys", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.parseBody();
  const label = String(body.label ?? "").trim() || undefined;

  const ctx = c.get("ctx");
  const created = await createApiKey(c.env.DB, tenantId, label, ctx.userId);
  // To the person who made it, not the workspace owner: it's their key.
  await notifyApiKeyIssued(c.env, ctx.userId, label ?? null);
  const workerOrigin = new URL(c.req.url).origin;
  const user = await getDashboardUser(c.env, ctx);
  return c.html(renderApiKeyCreated(created.plaintext, workerOrigin, user));
});

dashboard.post("/api-keys/:keyId/revoke", async (c) => {
  const tenantId = c.get("tenantId");
  await revokeApiKey(c.env.DB, tenantId, c.req.param("keyId"), c.get("ctx").userId);
  return c.redirect("/dashboard/api-keys?action=revoked", 303);
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



/** Team management is owner-only; members get a plain 403 rather than a silent no-op. */
function ownerOnly(ctx: TenantContext): Response | null {
  return ctx.role === "owner" ? null : new Response("forbidden: only the workspace owner can manage the team", { status: 403 });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

dashboard.post("/team/invites", async (c) => {
  const ctx = c.get("ctx");
  const denied = ownerOnly(ctx);
  if (denied) return denied;
  const env = c.env;
  if ((await getEffectivePlan(env.DB, ctx.tenantId)) !== "team") return c.redirect("/dashboard/settings?action=not_team", 303);

  const email = normalizeEmail(String((await c.req.parseBody()).email ?? ""));
  if (!EMAIL_PATTERN.test(email)) return c.redirect("/dashboard/settings?action=bad_email", 303);
  const pending = await listPendingInvites(env.DB, ctx.tenantId);
  if (pending.some((invite) => invite.email === email)) return c.redirect("/dashboard/settings?action=already_invited", 303);
  if ((await seatsUsed(env.DB, ctx.tenantId)) >= TEAM_SEATS) return c.redirect("/dashboard/settings?action=team_full", 303);

  const { token } = await createInvite(env.DB, ctx.tenantId, email, ctx.userId);
  const acceptUrl = new URL(`/dashboard/invite/${token}`, new URL(c.req.url).origin).toString();
  const sent = await notifyTeamInvite(env, email, await getTenantEmail(env, ctx.userId), acceptUrl);
  if (sent) return c.redirect("/dashboard/settings?action=invited", 303);
  // Email isn't configured (or failed): show the link once so the owner can
  // send it themselves, rendered directly rather than via a redirect so the
  // token never lands in a URL or browser history.
  return c.html(
    await settingsHtml(env, ctx, { type: "info", message: `Invite created, but email couldn't be sent. Share this link with ${email}: ${acceptUrl}` }, undefined)
  );
});

dashboard.post("/team/invites/:inviteId/revoke", async (c) => {
  const ctx = c.get("ctx");
  const denied = ownerOnly(ctx);
  if (denied) return denied;
  await revokeInvite(c.env.DB, ctx.tenantId, c.req.param("inviteId"));
  return c.redirect("/dashboard/settings?action=invite_revoked", 303);
});

dashboard.post("/team/members/:userId/remove", async (c) => {
  const ctx = c.get("ctx");
  const denied = ownerOnly(ctx);
  if (denied) return denied;
  await removeMember(c.env.DB, ctx.tenantId, c.req.param("userId"));
  return c.redirect("/dashboard/settings?action=member_removed", 303);
});

dashboard.post("/team/leave", async (c) => {
  const left = await leaveTeam(c.env.DB, c.get("ctx").userId);
  return c.redirect(left ? "/dashboard?action=left_team" : "/dashboard/settings", 303);
});

async function invitePageData(env: Env, ctx: TenantContext, token: string) {
  const invite = await getInviteByToken(env.DB, token);
  const [userEmail, ownerEmail, user] = await Promise.all([
    getTenantEmail(env, ctx.userId),
    invite ? getTenantEmail(env, invite.tenant_id) : Promise.resolve(null),
    getDashboardUser(env, ctx)
  ]);
  const blocker = await checkInvite(env.DB, invite, ctx.userId, userEmail);
  return { invite, data: { user, token, ownerEmail, inviteEmail: invite?.email ?? null, userEmail, blocker } };
}

// Reached from the invite email. A signed-out visitor gets the dashboard's
// normal sign-in page, whose redirect_url brings them straight back here.
dashboard.get("/invite/:token", async (c) => {
  const { data } = await invitePageData(c.env, c.get("ctx"), c.req.param("token"));
  return c.html(renderInvite(data), data.blocker ? 409 : 200);
});

dashboard.post("/invite/:token/accept", async (c) => {
  const ctx = c.get("ctx");
  const { invite, data } = await invitePageData(c.env, ctx, c.req.param("token"));
  if (data.blocker || !invite) return c.html(renderInvite(data), 409);
  if (!(await acceptInvite(c.env.DB, invite, ctx.userId))) {
    return c.html(renderInvite({ ...data, blocker: "already_used" }), 409);
  }
  return c.redirect("/dashboard?action=joined_team", 303);
});

// Every write action above is POST-only; nothing in this app ever links
// to a bare GET on one of these paths. The one thing that can still land
// a GET here is authenticateDashboardRequest's Clerk handshake redirect
// (see its doc comment): a handshake's redirect_url is always the
// original request's URL, and the round trip back from Clerk is always a
// GET, regardless of what the original request's method was. Registered
// last so it only catches whatever the specific routes above didn't.
dashboard.get("*", (c) => c.redirect("/dashboard", 303));
