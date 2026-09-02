import { buildAuthUrl, exchangeCodeForTokens } from "./google-oauth";
import type { ScopeGroup } from "../db/google-tokens";
import type { Env } from "../types/env";

const SCOPE_GROUPS: ScopeGroup[] = ["webmaster_console", "analytics_property"];

function isScopeGroup(value: string | null): value is ScopeGroup {
  return SCOPE_GROUPS.includes(value as ScopeGroup);
}

/**
 * Starts the Google consent flow. Gated by `setup_token` (reuses
 * MCP_BEARER_TOKEN) because this is a browser-hit GET route outside the
 * MCP endpoint's own bearer-header gate — without this, anyone who found
 * the URL could connect *their own* Google account to this deployment.
 */
export async function handleOAuthStart(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const setupToken = url.searchParams.get("setup_token");

  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return new Response("Google OAuth is not configured on this server", { status: 500 });
  }
  if (setupToken !== env.MCP_BEARER_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  if (!isScopeGroup(scope)) {
    return new Response(`scope must be one of: ${SCOPE_GROUPS.join(", ")}`, { status: 400 });
  }

  const redirectUri = new URL("/oauth/google/callback", url.origin).toString();
  return Response.redirect(buildAuthUrl(env, redirectUri, scope), 302);
}

export async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const scope = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`Google returned an error: ${error}`, { status: 400 });
  }
  if (!code || !isScopeGroup(scope)) {
    return new Response("missing or invalid code/state", { status: 400 });
  }

  const redirectUri = new URL("/oauth/google/callback", url.origin).toString();
  await exchangeCodeForTokens(env, code, redirectUri, scope);

  return new Response(
    `Connected. The "${scope}" tools are now enabled — you can close this tab.\n`,
    { status: 200 }
  );
}
