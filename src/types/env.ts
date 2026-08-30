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
}

export function hasDataForSEO(env: Env): boolean {
  return Boolean(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD);
}

export function hasGoogleOAuth(env: Env): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
}
