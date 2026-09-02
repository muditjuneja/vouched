import { getAnyToken, upsertToken, type ScopeGroup } from "../db/google-tokens";
import { ConnectionRequiredError, UpstreamError } from "../lib/errors";
import type { Env } from "../types/env";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * `openid email` is included so the callback can label the connected
 * account by email (decoded from the returned id_token) — it's a display
 * label, not used for authorization, so this server never verifies the
 * id_token's signature.
 */
const SCOPES: Record<ScopeGroup, string> = {
  webmaster_console: "openid email https://www.googleapis.com/auth/webmasters.readonly",
  analytics_property: "openid email https://www.googleapis.com/auth/analytics.readonly"
};

export function buildAuthUrl(env: Env, redirectUri: string, scopeGroup: ScopeGroup): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", env.GOOGLE_OAUTH_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES[scopeGroup]);
  url.searchParams.set("access_type", "offline");
  // Forces Google to (re)issue a refresh_token even on a repeat consent —
  // without this, reconnecting after a revoked/expired refresh_token would
  // silently fail to get a new one.
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", scopeGroup);
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
  token_type: string;
}

function expiresAtFrom(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

/** Decodes the id_token payload for its `email` claim. Not signature-verified — see SCOPES comment. */
function decodeEmailClaim(idToken: string): string {
  const payload = idToken.split(".")[1];
  if (!payload) return "unknown";
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { email?: string };
    return claims.email ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function exchangeCodeForTokens(
  env: Env,
  code: string,
  redirectUri: string,
  scopeGroup: ScopeGroup
): Promise<void> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  if (!res.ok) {
    throw new UpstreamError("google_oauth", await res.text(), res.status);
  }
  const tokens = (await res.json()) as TokenResponse;
  if (!tokens.refresh_token) {
    throw new UpstreamError(
      "google_oauth",
      "no refresh_token returned — Google only issues one on first consent per client; revoke access at https://myaccount.google.com/permissions and try again"
    );
  }

  await upsertToken(env.DB, {
    account_email: tokens.id_token ? decodeEmailClaim(tokens.id_token) : "unknown",
    scope_group: scopeGroup,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAtFrom(tokens.expires_in)
  });
}

async function refresh(env: Env, refreshToken: string): Promise<{ accessToken: string; expiresAt: string }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      grant_type: "refresh_token"
    })
  });
  if (!res.ok) {
    throw new UpstreamError("google_oauth", await res.text(), res.status);
  }
  const tokens = (await res.json()) as TokenResponse;
  return { accessToken: tokens.access_token, expiresAt: expiresAtFrom(tokens.expires_in) };
}

const EXPIRY_BUFFER_MS = 60_000;

/**
 * Returns a usable access token for the given scope group, refreshing it
 * first if it's expired (or about to). Throws `ConnectionRequiredError` if
 * nothing is connected at all, and `UpstreamError` if a refresh fails (a
 * revoked/expired refresh_token — this is the "reconnect_required" case).
 */
export async function getValidAccessToken(env: Env, scopeGroup: ScopeGroup): Promise<string> {
  const row = await getAnyToken(env.DB, scopeGroup);
  if (!row) {
    throw new ConnectionRequiredError(scopeGroup);
  }

  const expiresAt = new Date(row.expires_at).getTime();
  if (expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
    return row.access_token;
  }

  const { accessToken, expiresAt: newExpiresAt } = await refresh(env, row.refresh_token);
  await upsertToken(env.DB, {
    account_email: row.account_email,
    scope_group: scopeGroup,
    access_token: accessToken,
    refresh_token: row.refresh_token,
    expires_at: newExpiresAt
  });
  return accessToken;
}

export type ConnectionState = "connected" | "reconnect_required" | "not_connected";

/**
 * Cheap for the common case (a non-expired token needs no network call);
 * only reaches out to Google when the stored token is actually expired, to
 * tell "still fine" apart from "refresh_token was revoked".
 */
export async function checkConnectionState(env: Env, scopeGroup: ScopeGroup): Promise<ConnectionState> {
  const row = await getAnyToken(env.DB, scopeGroup);
  if (!row) return "not_connected";

  const expiresAt = new Date(row.expires_at).getTime();
  if (expiresAt - Date.now() > EXPIRY_BUFFER_MS) return "connected";

  try {
    await getValidAccessToken(env, scopeGroup);
    return "connected";
  } catch {
    return "reconnect_required";
  }
}
