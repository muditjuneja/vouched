import { verifyToken } from "@clerk/backend";
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
