import { resolveTenant } from "../db/team";
import { authenticateBillingRequest } from "./clerk";
import { buildAuthUrl, exchangeCodeForTokens, type OAuthReturnTo } from "./google-oauth";
import { importGoogleSites } from "./google-sites";
import type { ScopeGroup } from "../db/google-tokens";
import { isCloudMode, type Env } from "../types/env";

export const SCOPE_GROUPS: ScopeGroup[] = ["webmaster_console", "analytics_property"];

export function isScopeGroup(value: string): value is ScopeGroup {
  return SCOPE_GROUPS.includes(value as ScopeGroup);
}

/**
 * Ties a consent flow to the browser that started it: /oauth/google/start
 * puts a random nonce both here and in Google's `state`, and the callback
 * only accepts a `state` whose nonce matches. Without it, a callback URL
 * carrying someone else's authorization code (or a consent link built by
 * someone else) could attach a Google account to the wrong workspace.
 * SameSite=Lax still sends it on the top-level redirect back from Google.
 */
const STATE_COOKIE = "__Host-google_oauth_state";
const STATE_TTL_SECONDS = 600;

function stateCookie(value: string, maxAgeSeconds: number): string {
  return `${STATE_COOKIE}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

function readStateCookie(request: Request): string | null {
  const match = new RegExp(`(?:^|;\\s*)${STATE_COOKIE}=([^;]+)`).exec(request.headers.get("cookie") ?? "");
  return match?.[1] ?? null;
}

function newNonce(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

/**
 * Starts the Google consent flow.
 * - Self-host: gated by `setup_token` (reuses MCP_BEARER_TOKEN) because
 *   this is a browser-hit GET route outside the MCP endpoint's own
 *   bearer-header gate: without this, anyone who found the URL could
 *   connect *their own* Google account to this deployment.
 * - Cloud mode: gated by a Clerk session instead: the dashboard links
 *   here, so the browser already carries one. The callback checks that
 *   same session again to decide which workspace the tokens belong to.
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

  let withRefreshedCookies = (response: Response) => response;
  if (isCloudMode(env)) {
    // Same stale-token handling as the billing routes (a bare session check
    // 401'd a genuinely signed-in user whose token was due for refresh).
    const auth = await authenticateBillingRequest(request, env);
    if (!auth.ok) return auth.response;
    withRefreshedCookies = auth.withRefreshedCookies;
  } else {
    const setupToken = url.searchParams.get("setup_token");
    if (setupToken !== env.MCP_BEARER_TOKEN) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const returnTo: OAuthReturnTo = url.searchParams.get("returnTo") === "websites" ? "websites" : "settings";
  const redirectUri = new URL("/oauth/google/callback", url.origin).toString();
  const nonce = newNonce();
  const headers = new Headers({ Location: buildAuthUrl(env, redirectUri, scope, nonce, returnTo) });
  headers.append("Set-Cookie", stateCookie(nonce, STATE_TTL_SECONDS));
  return withRefreshedCookies(new Response(null, { status: 302, headers }));
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

  // See buildAuthUrl's doc comment: state is "<scope>:<returnTo>:<nonce>".
  const [scope = "", returnTo, nonce] = state.split(":");
  if (!isScopeGroup(scope) || !nonce) {
    return new Response("invalid state", { status: 400 });
  }
  if (readStateCookie(request) !== nonce) {
    return new Response("This Google connection wasn't started from this browser, or took too long. Start connecting again.", { status: 400 });
  }

  // Cloud mode: the tokens go to the workspace of whoever is signed in
  // right now, never to one named by the request. A handshake redirect
  // comes back to this same URL with the code still unused.
  let tenantId: string | null = null;
  let withRefreshedCookies = (response: Response) => response;
  if (isCloudMode(env)) {
    const auth = await authenticateBillingRequest(request, env);
    if (!auth.ok) return auth.response;
    tenantId = (await resolveTenant(env.DB, auth.session.userId)).tenantId;
    withRefreshedCookies = auth.withRefreshedCookies;
  }

  const redirectUri = new URL("/oauth/google/callback", url.origin).toString();
  await exchangeCodeForTokens(env, code, redirectUri, scope, tenantId);
  // Track the account's sites now, so its data is queryable straight away.
  // Best-effort: a listing failure must never undo a successful connection.
  await importGoogleSites(env, scope, tenantId).catch((error: unknown) => console.warn(`[oauth] importing ${scope} sites failed:`, error));

  // Cloud mode: this is a same-tab navigation from the dashboard (the
  // connect link is a plain <a>, not a popup), so land back on a real,
  // navigable page instead of a dead-end text response with no way back.
  // Self-host has no dashboard to return to at all, so it keeps the plain
  // text response.
  const headers = new Headers({ "Set-Cookie": stateCookie("", 0) });
  if (tenantId) {
    const page = returnTo === "websites" ? "websites" : "settings";
    headers.set("Location", new URL(`/dashboard/${page}?connected=${scope}`, url.origin).toString());
    return withRefreshedCookies(new Response(null, { status: 302, headers }));
  }

  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response(`Connected. The "${scope}" tools are now enabled, you can close this tab.\n`, { status: 200, headers });
}
