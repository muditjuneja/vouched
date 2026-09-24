import { createClerkClient, type ClerkClient } from "@clerk/backend";
import { ConfigError } from "../lib/errors";
import type { Env } from "../types/env";

export interface ClerkSession {
  /** The signed-in Clerk user id. Not necessarily the tenant: a team member acts in the owner's workspace, see src/db/team.ts's resolveTenant. */
  userId: string;
  /** The Clerk session id, needed to end the session on sign-out. Always set for a real session; optional so tests can omit it. */
  sessionId?: string;
}

export interface DashboardAuthResult {
  /** Non-null once a real session has been established. */
  session: ClerkSession | null;
  /** Set only when Clerk's handshake protocol needs a round trip: return this response as-is, unchanged, to the browser. */
  handshakeRedirect: Response | null;
  /** Set only when a stale session token was silently refreshed via the same-cookie GET probe below: append these onto whatever response the real request produces, so the browser's cookie jar picks up the refreshed token too. */
  refreshedSetCookies: string[];
  /**
   * Development Clerk instances only: this browser's "dev browser" id, which
   * the sign-in link must pass to Clerk's hosted sign-in page. Without it the
   * sign-in happens under a different id than the one this site checks, and
   * the user comes back still signed out. Null on production instances.
   */
  devBrowserToken?: string | null;
}

/** Reads the dev-browser cookie (plain or Clerk's suffixed variant) when the publishable key is a development one. */
function devBrowserTokenFrom(request: Request, publishableKey: string): string | null {
  if (!publishableKey.startsWith("pk_test_")) return null;
  const match = /(?:^|;\s*)__clerk_db_jwt(?:_[^=;]+)?=([^;]+)/.exec(request.headers.get("cookie") ?? "");
  return match?.[1] ?? null;
}

/**
 * Verifies a dashboard *page* request, completing Clerk's handshake
 * protocol when needed instead of only checking for an existing session.
 *
 * Locally (and on any deployment without a custom Clerk domain), Clerk's
 * hosted Account Portal lives on a different origin than this app, so
 * right after sign-in it can't set a same-origin `__session` cookie
 * directly: it redirects back with a `__clerk_db_jwt` query param
 * instead. `ClerkClient.authenticateRequest` (unlike a bare `verifyToken`
 * check, which this file used to have) recognizes that param and, when
 * it finds one, returns a `handshake` status carrying redirect headers
 * that bounce the browser through Clerk's Frontend API and back, this
 * time with a real `__session` cookie set. Skipping this step is exactly
 * why the dashboard's entry gate used to 401 forever right after a
 * successful Clerk sign-in, confirmed against a real Clerk app: see
 * docs/CLOUD.md's M12 entry, dated 2026-09-22.
 *
 * A second, separate issue: Clerk's session token (the JWT inside
 * `__session`) is short-lived by design, meant to be silently refreshed
 * every so often. `@clerk/backend`'s own source (dist/internal.js:
 * `isRequestEligibleForHandshake`, `isRequestEligibleForRefresh`) hard-
 * requires `request.method === "GET"` for both the handshake redirect
 * and the silent same-request refresh, so once that token goes stale, a
 * plain form POST (adding a website, creating/revoking an API key) gets
 * treated as fully signed out, even with a perfectly valid underlying
 * browser session, confirmed against a real Clerk app: the user hit this
 * exact case clicking "Add website" and landing on "sign in required".
 * Since Clerk's refresh logic only cares about cookies, not the request
 * body, a same-cookie GET clone of the real request is enough to satisfy
 * that check without ever exposing the clone to the browser (no redirect
 * is sent for it, it's a purely server-side, in-process probe).
 *
 * `makeClient` is injectable so tests don't need a real Clerk account,
 * same pattern as getTenantEmail below.
 */
export async function authenticateDashboardRequest(
  request: Request,
  env: Env,
  makeClient: typeof createClerkClient = createClerkClient
): Promise<DashboardAuthResult> {
  if (!env.CLERK_PUBLISHABLE_KEY) {
    throw new ConfigError("Clerk is missing CLERK_PUBLISHABLE_KEY (needed for the sign-in handshake, distinct from CLERK_SECRET_KEY)");
  }

  const client = makeClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    jwtKey: env.CLERK_JWT_KEY
  });
  const requestState = await client.authenticateRequest(request);

  if (requestState.status === "handshake") {
    // 303, not 307: Clerk's handshake endpoint is a GET-only browser
    // navigation target (confirmed against a real Clerk app: a POST that
    // needed this fallback got a 405 straight from *.accounts.dev when this
    // used 307, which preserves the original request's method on redirect).
    // 303 always switches the browser to GET regardless of what the
    // original request's method was, which is what a redirect-based
    // handshake needs. Safe for the plain-GET case above too: 303 and 307
    // behave identically when the original method was already GET.
    return { session: null, handshakeRedirect: new Response(null, { status: 303, headers: requestState.headers }), refreshedSetCookies: [] };
  }
  if (requestState.status === "signed-in") {
    const auth = requestState.toAuth();
    // requestState.headers carries real Set-Cookie values (not just an
    // empty Headers()) whenever this "signed-in" came from resolving a
    // __clerk_handshake token on the way back from a handshake redirect,
    // the actual freshly-issued session/refresh cookies live here and
    // nowhere else. Forwarding it unconditionally is always safe (a
    // plain already-valid session check leaves this Headers() empty, so
    // getSetCookie() is just []), and skipping it here is exactly what
    // silently broke the fix above: the browser's cookie jar never
    // picked up the resolved handshake's fresh session, so it kept
    // presenting the same dead one on every request after.
    return { session: { userId: auth.userId, sessionId: auth.sessionId }, handshakeRedirect: null, refreshedSetCookies: requestState.headers.getSetCookie() };
  }

  if (request.method !== "GET") {
    const probe = new Request(request.url, { method: "GET", headers: request.headers });
    const probeState = await client.authenticateRequest(probe);
    if (probeState.status === "signed-in") {
      const auth = probeState.toAuth();
      return { session: { userId: auth.userId, sessionId: auth.sessionId }, handshakeRedirect: null, refreshedSetCookies: probeState.headers.getSetCookie() };
    }
    // A silent, same-request refresh isn't always enough (some stale-token
    // reasons need a real round trip through Clerk's Frontend API, not
    // just a cookie swap); the probe being GET makes it eligible for a
    // real handshake too. That handshake's redirect_url is this same
    // POST's URL, so whatever lands here on the way back arrives as a
    // GET; see the dashboard's catch-all GET fallback in
    // src/dashboard/routes.ts for why that's harmless.
    if (probeState.status === "handshake") {
      // Same 303-not-307 reasoning as above: this is what a POST (e.g.
      // disconnect, add website) hits when a silent refresh alone isn't
      // enough. 307 would preserve the original POST onto Clerk's
      // GET-only handshake endpoint and 405 there instead of completing
      // the round trip.
      return { session: null, handshakeRedirect: new Response(null, { status: 303, headers: probeState.headers }), refreshedSetCookies: [] };
    }
  }

  // Signed out. On a development instance this can be the resolution of a
  // handshake: Clerk then sets this site's dev-browser cookie and redirects
  // to the same URL minus its handshake query params. Both have to reach the
  // browser, or the next request starts over with no dev browser.
  if (requestState.headers.get("location")) {
    return { session: null, handshakeRedirect: new Response(null, { status: 303, headers: requestState.headers }), refreshedSetCookies: [] };
  }
  return {
    session: null,
    handshakeRedirect: null,
    refreshedSetCookies: requestState.headers.getSetCookie(),
    devBrowserToken: devBrowserTokenFrom(request, env.CLERK_PUBLISHABLE_KEY)
  };
}

/**
 * Ends a Clerk session on Clerk's side. Clearing our own cookies isn't
 * enough: Clerk would still hold an active session, and the next page's
 * handshake would quietly sign the user back in. Never throws; returns
 * whether Clerk confirmed it.
 */
export async function revokeClerkSession(env: Env, sessionId: string, makeClient: typeof createClerkClient = createClerkClient): Promise<boolean> {
  try {
    await makeClient({ secretKey: env.CLERK_SECRET_KEY }).sessions.revokeSession(sessionId);
    return true;
  } catch (error) {
    console.warn(`[auth] couldn't revoke Clerk session ${sessionId}: ${String(error)}`);
    return false;
  }
}

/**
 * Whether this browser looks signed in, from Clerk's `__client_uat` cookie
 * (a sign-in timestamp while signed in, "0" or absent once signed out). Only
 * a hint for what public pages show: it isn't verified, so never gate
 * anything on it. The dashboard does the real check.
 */
export function looksSignedIn(request: Request): boolean {
  const values = [...(request.headers.get("cookie") ?? "").matchAll(/(?:^|;\s*)__client_uat(?:_[^=;]+)?=([^;]*)/g)].map((m) => Number(m[1]));
  return values.length > 0 && values.every((v) => v > 0);
}

export type BillingAuthResult =
  | { ok: true; session: ClerkSession; withRefreshedCookies: (response: Response) => Response }
  | { ok: false; response: Response };

/**
 * Same handshake + silent-refresh robustness authenticateDashboardRequest
 * gives the dashboard, collapsed into one call for the handful of bare
 * billing routes (checkout/topup/portal) that predate the dashboard and
 * were still gated by a bare verifyToken session check, confirmed against
 * a real Clerk session: a token due for its silent refresh 401s on these
 * routes ("unauthorized: sign in first") even though the exact same
 * browser session refreshes fine on any dashboard page, since only the
 * dashboard's gate ever attempted the refresh/handshake dance at all.
 *
 * On success, call `withRefreshedCookies(response)` on whatever response
 * the route eventually builds (redirect, error, whatever) so a
 * silently-refreshed token's cookies still reach the browser; it's a
 * no-op when nothing was refreshed.
 */
export async function authenticateBillingRequest(
  request: Request,
  env: Env,
  makeClient: typeof createClerkClient = createClerkClient
): Promise<BillingAuthResult> {
  let auth: DashboardAuthResult;
  try {
    auth = await authenticateDashboardRequest(request, env, makeClient);
  } catch (error) {
    if (error instanceof ConfigError) return { ok: false, response: new Response(error.message, { status: 500 }) };
    throw error;
  }
  if (auth.handshakeRedirect) return { ok: false, response: auth.handshakeRedirect };
  if (!auth.session) return { ok: false, response: new Response("unauthorized: sign in first", { status: 401 }) };

  const refreshedSetCookies = auth.refreshedSetCookies;
  return {
    ok: true,
    session: auth.session,
    withRefreshedCookies: (response) => {
      if (refreshedSetCookies.length === 0) return response;
      const headers = new Headers(response.headers);
      for (const cookie of refreshedSetCookies) headers.append("Set-Cookie", cookie);
      return new Response(response.body, { status: response.status, headers });
    }
  };
}

/**
 * Looks up a tenant's email address from Clerk, needed by src/email/
 * notifications.ts, since neither a Clerk session token nor Dodo's webhook
 * payload reliably carries one. Verified against @clerk/backend 3.17's real
 * type declarations (node_modules/@clerk/backend/dist/api/endpoints/
 * UserApi.d.ts, .../resources/User.d.ts): `ClerkClient.users.getUser`
 * returns a User with `emailAddresses`/`primaryEmailAddressId`.
 *
 * Unlike `verifyToken`, this is a real network call to Clerk's API (a user
 * lookup, not a session verification), made on demand per notification
 * send, using the same CLERK_SECRET_KEY cloud mode already requires.
 * `makeClient` is injectable so tests don't need a real Clerk account.
 * Never throws: a lookup failure just means "skip this email".
 */
export async function getTenantEmail(
  env: Env,
  tenantId: string,
  makeClient: typeof createClerkClient = createClerkClient
): Promise<string | null> {
  try {
    const client: ClerkClient = makeClient({ secretKey: env.CLERK_SECRET_KEY });
    const user = await client.users.getUser(tenantId);
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
    return (primary ?? user.emailAddresses[0])?.emailAddress ?? null;
  } catch {
    return null;
  }
}
