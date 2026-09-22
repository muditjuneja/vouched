import { createClerkClient, verifyToken, type ClerkClient } from "@clerk/backend";
import { ConfigError } from "../lib/errors";
import type { Env } from "../types/env";

const SESSION_COOKIE_NAME = "__session";

/** Exported for unit testing the header/cookie parsing without a real Clerk instance. */
export function extractSessionToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) return rest.join("=") || null;
  }
  return null;
}

export interface ClerkSession {
  /** The Clerk user id, this server's tenant_id everywhere else. */
  userId: string;
}

/**
 * Verifies a dashboard request's Clerk session (from the Authorization
 * header or Clerk's `__session` cookie). Prefers CLERK_JWT_KEY (a PEM
 * public key from the Clerk dashboard) for zero-network-roundtrip
 * verification, Clerk's own recommendation for edge runtimes, falling
 * back to CLERK_SECRET_KEY (which verifies against Clerk's API instead)
 * when only that's configured. Returns null for anything invalid/expired/
 * missing rather than throwing: "not logged in" is expected, not
 * exceptional, for a dashboard route.
 *
 * Only checks for a session that already exists. It never establishes
 * one, so it's the wrong tool for the entry gate right after a Clerk
 * redirect, see authenticateDashboardRequest below for why.
 */
export async function verifyClerkSession(request: Request, env: Env): Promise<ClerkSession | null> {
  const token = extractSessionToken(request);
  if (!token) return null;

  try {
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      jwtKey: env.CLERK_JWT_KEY
    });
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export interface DashboardAuthResult {
  /** Non-null once a real session has been established. */
  session: ClerkSession | null;
  /** Set only when Clerk's handshake protocol needs a round trip: return this response as-is, unchanged, to the browser. */
  handshakeRedirect: Response | null;
  /** Set only when a stale session token was silently refreshed via the same-cookie GET probe below: append these onto whatever response the real request produces, so the browser's cookie jar picks up the refreshed token too. */
  refreshedSetCookies: string[];
}

/**
 * Verifies a dashboard *page* request, completing Clerk's handshake
 * protocol when needed instead of only checking for an existing session
 * the way verifyClerkSession above does.
 *
 * Locally (and on any deployment without a custom Clerk domain), Clerk's
 * hosted Account Portal lives on a different origin than this app, so
 * right after sign-in it can't set a same-origin `__session` cookie
 * directly: it redirects back with a `__clerk_db_jwt` query param
 * instead. `ClerkClient.authenticateRequest` (unlike the bare
 * `verifyToken` verifyClerkSession uses) recognizes that param and, when
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
    return { session: null, handshakeRedirect: new Response(null, { status: 307, headers: requestState.headers }), refreshedSetCookies: [] };
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
    return { session: { userId: auth.userId }, handshakeRedirect: null, refreshedSetCookies: requestState.headers.getSetCookie() };
  }

  if (request.method !== "GET") {
    const probe = new Request(request.url, { method: "GET", headers: request.headers });
    const probeState = await client.authenticateRequest(probe);
    if (probeState.status === "signed-in") {
      const auth = probeState.toAuth();
      return { session: { userId: auth.userId }, handshakeRedirect: null, refreshedSetCookies: probeState.headers.getSetCookie() };
    }
    // A silent, same-request refresh isn't always enough (some stale-token
    // reasons need a real round trip through Clerk's Frontend API, not
    // just a cookie swap); the probe being GET makes it eligible for a
    // real handshake too. That handshake's redirect_url is this same
    // POST's URL, so whatever lands here on the way back arrives as a
    // GET; see the dashboard's catch-all GET fallback in
    // src/dashboard/routes.ts for why that's harmless.
    if (probeState.status === "handshake") {
      return { session: null, handshakeRedirect: new Response(null, { status: 307, headers: probeState.headers }), refreshedSetCookies: [] };
    }
  }

  return { session: null, handshakeRedirect: null, refreshedSetCookies: [] };
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
