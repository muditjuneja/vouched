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

  // Secrets — required
  MCP_BEARER_TOKEN: string;

  // Secrets — unlock the DataForSEO-backed tier (seo/serp/backlinks/ai_visibility)
  DATAFORSEO_LOGIN?: string;
  DATAFORSEO_PASSWORD?: string;
  DATAFORSEO_DAILY_BUDGET_USD?: string;

  // Secrets — unlock the gsc/analytics tools
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;

  // Optional — raises audit_site's PageSpeed Insights quota
  PAGESPEED_API_KEY?: string;

  // Cloud offering (M10+) — unset means self-host mode: today's behavior,
  // byte-for-byte, exactly as before this milestone. Secrets below are only
  // ever read once isCloudMode(env) is true.
  CLOUD_MODE?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_KEY?: string; // PEM public key — enables verifyToken() with zero network roundtrip
  DODO_API_KEY?: string;
  DODO_WEBHOOK_SECRET?: string;
  XMIT_API_KEY?: string;
  // The cloud tier's own DataForSEO account — distinct from
  // DATAFORSEO_LOGIN/PASSWORD above, which remain the self-host BYOK path.
  CLOUD_DATAFORSEO_LOGIN?: string;
  CLOUD_DATAFORSEO_PASSWORD?: string;

  /**
   * NOT a real Worker binding/secret — a per-request field `buildMcpServer`
   * sets on a shallow copy of `env` before calling a tool's handler, so the
   * handful of tools that need to know "which tenant is calling" (currently
   * list_websites, get_search_performance, get_website_analytics) can read
   * it without every ToolModule's signature having to change. Always null
   * in self-host mode. See src/mcp/server.ts.
   */
  __tenantId?: string | null;
}

export function hasDataForSEO(env: Env): boolean {
  return Boolean(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD);
}

export function hasGoogleOAuth(env: Env): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/**
 * Cloud mode gates every M10+ addition (multi-tenant auth, billing,
 * bundled DataForSEO, email). Off (the self-host default) means none of
 * that code path is reachable at all — same single-user server as M0-M9.
 */
export function isCloudMode(env: Env): boolean {
  return Boolean(env.CLOUD_MODE) && Boolean(env.CLERK_SECRET_KEY);
}
