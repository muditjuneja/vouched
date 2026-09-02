import { createClerkClient, verifyToken, type ClerkClient } from "@clerk/backend";
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
  /** The Clerk user id — this server's tenant_id everywhere else. */
  userId: string;
}

/**
 * Verifies a dashboard request's Clerk session (from the Authorization
 * header or Clerk's `__session` cookie). Prefers CLERK_JWT_KEY (a PEM
 * public key from the Clerk dashboard) for zero-network-roundtrip
 * verification — Clerk's own recommendation for edge runtimes — falling
 * back to CLERK_SECRET_KEY (which verifies against Clerk's API instead)
 * when only that's configured. Returns null for anything invalid/expired/
 * missing rather than throwing — "not logged in" is expected, not
 * exceptional, for a dashboard route.
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

/**
 * Looks up a tenant's email address from Clerk — needed by src/email/
 * notifications.ts, since neither a Clerk session token nor Dodo's webhook
 * payload reliably carries one. Verified against @clerk/backend 3.17's real
 * type declarations (node_modules/@clerk/backend/dist/api/endpoints/
 * UserApi.d.ts, .../resources/User.d.ts): `ClerkClient.users.getUser`
 * returns a User with `emailAddresses`/`primaryEmailAddressId`.
 *
 * Unlike `verifyToken`, this is a real network call to Clerk's API (a user
 * lookup, not a session verification) — made on demand per notification
 * send, using the same CLERK_SECRET_KEY cloud mode already requires.
 * `makeClient` is injectable so tests don't need a real Clerk account.
 * Never throws — a lookup failure just means "skip this email".
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
