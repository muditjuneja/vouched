import { resolveTenant } from "../db/team";
import { authenticateBillingRequest } from "./clerk";
import { buildAuthUrl, exchangeCodeForTokens, type OAuthReturnTo } from "./google-oauth";
import type { ScopeGroup } from "../db/google-tokens";
import { isCloudMode, type Env } from "../types/env";

export const SCOPE_GROUPS: ScopeGroup[] = ["webmaster_console", "analytics_property"];

export function isScopeGroup(value: string): value is ScopeGroup {
  return SCOPE_GROUPS.includes(value as ScopeGroup);
}

/**
 * Starts the Google consent flow.
 * - Self-host: gated by `setup_token` (reuses MCP_BEARER_TOKEN) because
 *   this is a browser-hit GET route outside the MCP endpoint's own
 *   bearer-header gate: without this, anyone who found the URL could
 *   connect *their own* Google account to this deployment.
 * - Cloud mode: gated by a Clerk session instead: the dashboard links
 *   here, so the browser already carries one. The Clerk user id rides
 *   through Google's `state` param so the callback knows which tenant's
 *   tokens these are.
 */
export async function handleOAuthStart(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");

  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return new Response("Google OAuth is not configured on this server", { status: 500 });
  }
  if (!scope || !isScopeGroup(scope)) {
    return new Response(`scope must be one of: ${SCOPE_GROUPS.join(", ")}`, { status: 400 });
  }

  let tenantId: string | null = null;
  if (isCloudMode(env)) {
    // Same stale-token handling as the billing routes (a bare session check
    // 401'd a genuinely signed-in user whose token was due for refresh).
    const auth = await authenticateBillingRequest(request, env);
    if (!auth.ok) return auth.response;
    // A team member connects Google for the team's workspace, not their
    // own personal one.
    tenantId = (await resolveTenant(env.DB, auth.session.userId)).tenantId;
  } else {
    const setupToken = url.searchParams.get("setup_token");
    if (setupToken !== env.MCP_BEARER_TOKEN) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const returnTo: OAuthReturnTo = url.searchParams.get("returnTo") === "websites" ? "websites" : "settings";
  const redirectUri = new URL("/oauth/google/callback", url.origin).toString();
  return Response.redirect(buildAuthUrl(env, redirectUri, scope, tenantId, returnTo), 302);
}

export async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`Google returned an error: ${error}`, { status: 400 });
  }
  if (!code || !state) {
    return new Response("missing code/state", { status: 400 });
  }

  // See buildAuthUrl's doc comment: state is "<scope>" (self-host) or
  // "<scope>:<tenantId>:<returnTo>" (cloud mode).
  const [scope, tenantId, returnTo] = state.includes(":") ? state.split(":") : [state, null, null];
  if (!isScopeGroup(scope)) {
    return new Response("invalid state", { status: 400 });
  }

  const redirectUri = new URL("/oauth/google/callback", url.origin).toString();
  await exchangeCodeForTokens(env, code, redirectUri, scope, tenantId ?? null);

  // Cloud mode: this is a same-tab navigation from the dashboard (the
  // connect link is a plain <a>, not a popup), so land back on a real,
  // navigable page instead of a dead-end text response with no way back.
  // Self-host has no dashboard to return to at all (isCloudMode is false,
  // or this callback was reached via the setup_token path with no
  // tenant), so it keeps the plain text response.
  if (isCloudMode(env) && tenantId) {
    const page = returnTo === "websites" ? "websites" : "settings";
    return Response.redirect(new URL(`/dashboard/${page}?connected=${scope}`, url.origin).toString(), 302);
  }

  return new Response(
    `Connected. The "${scope}" tools are now enabled, you can close this tab.\n`,
    { status: 200 }
  );
}
