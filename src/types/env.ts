/**
 * The Worker's bindings + secrets. `D1Database`/`R2Bucket`/`ExecutionContext`
 * come from the ambient `@cloudflare/workers-types` types (see tsconfig).
 * Hand-written rather than `wrangler types`-generated so it stays reviewable
 * in a plain diff; keep it in sync with wrangler.jsonc.
 */
export interface Env {
  // Bindings (wrangler.jsonc)
  DB: D1Database;
  DATASETS: R2Bucket;

  // Secrets: required
  MCP_BEARER_TOKEN: string;

  // Secrets: unlock the DataForSEO-backed tier (seo/serp/backlinks/ai_visibility)
  DATAFORSEO_LOGIN?: string;
  DATAFORSEO_PASSWORD?: string;
  DATAFORSEO_DAILY_BUDGET_USD?: string;

  // Secrets: unlock the gsc/analytics tools
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;

  // Optional: raises audit_site's PageSpeed Insights quota
  PAGESPEED_API_KEY?: string;

  // Cloud offering (M10+): unset means self-host mode, today's behavior,
  // byte-for-byte, exactly as before this milestone. Secrets below are only
  // ever read once isCloudMode(env) is true.
  CLOUD_MODE?: string;
  CLERK_SECRET_KEY?: string;
  /** Client-side Clerk key, distinct from CLERK_SECRET_KEY: required by authenticateDashboardRequest's handshake redirect (src/auth/clerk.ts), which needs it to build the round-trip URL back to Clerk's Frontend API. */
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_JWT_KEY?: string; // PEM public key, enables verifyToken() with zero network roundtrip
  /** Where the dashboard sends an unauthenticated visitor: Clerk's Account Portal or a custom sign-in page. A `redirect_url` param is appended. */
  CLERK_SIGN_IN_URL?: string;
  DODO_API_KEY?: string;
  DODO_WEBHOOK_SECRET?: string;
  /** "live_mode" or "test_mode" (Dodo's own enum). Defaults to test_mode when unset, never live by accident. */
  DODO_ENVIRONMENT?: string;
  /** Dodo product ids for the Pro/Team plans, created in the Dodo dashboard: deployment-specific, not hardcoded. */
  DODO_PRODUCT_ID_PRO?: string;
  DODO_PRODUCT_ID_TEAM?: string;
  /** A single "pay what you want" Dodo product backing wallet top-ups (src/billing/dodo-client.ts's startWalletTopup): its price is overridden per checkout, so one product id covers every top-up amount. */
  DODO_PRODUCT_ID_WALLET_TOPUP?: string;
  XMIT_API_KEY?: string;
  /** The From address for transactional email: deployment-specific, no hardcoded domain guessed here. */
  XMIT_FROM_EMAIL?: string;
  /** Override for xmit.sh's API base URL: a safety valve since the endpoint path itself is a best-effort guess (see src/email/client.ts). Defaults to https://api.xmit.sh. */
  XMIT_API_BASE_URL?: string;
  // The cloud tier's own DataForSEO account, distinct from
  // DATAFORSEO_LOGIN/PASSWORD above, which remain the self-host BYOK path.
  CLOUD_DATAFORSEO_LOGIN?: string;
  CLOUD_DATAFORSEO_PASSWORD?: string;

  /** Optional Slack/Discord incoming-webhook URL for operator alerts (billing failures, budget warnings). No-op when unset. */
  ADMIN_ALERT_WEBHOOK_URL?: string;
  /** Requests per minute per cloud tenant on /mcp, see src/lib/rate-limit.ts. Defaults to 60 when unset. */
  RATE_LIMIT_PER_MINUTE?: string;

  /**
   * NOT a real Worker binding/secret: a per-request field `buildMcpServer`
   * sets on a shallow copy of `env` before calling a tool's handler, so the
   * handful of tools that need to know "which tenant is calling" (currently
   * list_websites, get_search_performance, get_website_analytics) can read
   * it without every ToolModule's signature having to change. Always null
   * in self-host mode. See src/mcp/server.ts.
   */
  __tenantId?: string | null;
}

/**
 * True whenever *some* DataForSEO credentials are usable: self-host's
 * own BYOK login/password, or (in cloud mode) the deployment's bundled
 * account. Doesn't say whether *this tenant* is allowed to use them,
 * that's a per-tenant plan/quota check, done at call time in
 * src/clients/dataforseo/client.ts, not here.
 */
export function hasDataForSEO(env: Env): boolean {
  const byok = Boolean(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD);
  const bundled = isCloudMode(env) && Boolean(env.CLOUD_DATAFORSEO_LOGIN && env.CLOUD_DATAFORSEO_PASSWORD);
  return byok || bundled;
}

export function hasGoogleOAuth(env: Env): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/** True when transactional email (src/email/) is configured; cloud mode only reads this. */
export function hasEmail(env: Env): boolean {
  return Boolean(env.XMIT_API_KEY);
}

/** True when Dodo Payments (src/billing/) is configured; cloud mode only reads this. */
export function hasDodo(env: Env): boolean {
  return Boolean(env.DODO_API_KEY);
}

/**
 * Cloud mode gates every M10+ addition (multi-tenant auth, billing,
 * bundled DataForSEO, email). Off (the self-host default) means none of
 * that code path is reachable at all: same single-user server as M0-M9.
 */
export function isCloudMode(env: Env): boolean {
  return Boolean(env.CLOUD_MODE) && Boolean(env.CLERK_SECRET_KEY);
}
