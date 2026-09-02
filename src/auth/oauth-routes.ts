import { verifyClerkSession } from "./clerk";
import { buildAuthUrl, exchangeCodeForTokens } from "./google-oauth";
import type { ScopeGroup } from "../db/google-tokens";
import { isCloudMode, type Env } from "../types/env";

const SCOPE_GROUPS: ScopeGroup[] = ["webmaster_console", "analytics_property"];

function isScopeGroup(value: string): value is ScopeGroup {
  return SCOPE_GROUPS.includes(value as ScopeGroup);
}

/**
 * Starts the Google consent flow.
 * - Self-host: gated by `setup_token` (reuses MCP_BEARER_TOKEN) because
 *   this is a browser-hit GET route outside the MCP endpoint's own
 *   bearer-header gate — without this, anyone who found the URL could
 *   connect *their own* Google account to this deployment.
 * - Cloud mode: gated by a Clerk session instead — the dashboard links
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
    const session = await verifyClerkSession(request, env);
    if (!session) {
      return new Response("unauthorized — sign in first", { status: 401 });
    }
    tenantId = session.userId;
  } else {
    const setupToken = url.searchParams.get("setup_token");
    if (setupToken !== env.MCP_BEARER_TOKEN) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const redirectUri = new URL("/oauth/google/callback", url.origin).toString();
  return Response.redirect(buildAuthUrl(env, redirectUri, scope, tenantId), 302);
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

  // See buildAuthUrl's doc comment — state is "<scope>" (self-host) or
  // "<scope>:<tenantId>" (cloud mode).
  const [scope, tenantId] = state.includes(":")
    ? (state.split(":") as [string, string])
    : [state, null];
  if (!isScopeGroup(scope)) {
    return new Response("invalid state", { status: 400 });
  }

  const redirectUri = new URL("/oauth/google/callback", url.origin).toString();
  await exchangeCodeForTokens(env, code, redirectUri, scope, tenantId);

  return new Response(
    `Connected. The "${scope}" tools are now enabled — you can close this tab.\n`,
    { status: 200 }
  );
}
