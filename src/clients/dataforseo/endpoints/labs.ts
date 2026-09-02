import type { Env } from "../../../types/env";
import { dfsLivePost } from "../client";
import { DEFAULT_LANGUAGE_CODE, DEFAULT_LOCATION_CODE } from "../locations";

/**
 * Every function here returns the raw `result[]` array from DataForSEO —
 * see client.ts's doc comment on why field extraction downstream stays
 * defensive (optional chaining, `raw` passthrough) rather than strictly
 * typed: only the endpoint *paths* below are confirmed, not the full
 * request/response schemas.
 */

export function domainRankOverview(env: Env, toolName: string, target: string) {
  return dfsLivePost(env, toolName, "/v3/dataforseo_labs/google/domain_rank_overview/live", {
    target,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE
  });
}

export function rankedKeywords(
  env: Env,
  toolName: string,
  target: string,
  opts: { limit?: number; filters?: unknown[] } = {}
) {
  return dfsLivePost(env, toolName, "/v3/dataforseo_labs/google/ranked_keywords/live", {
    target,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE,
    limit: opts.limit ?? 50,
    ...(opts.filters ? { filters: opts.filters } : {})
  });
}

export function competitorsDomain(env: Env, toolName: string, target: string, limit = 20) {
  return dfsLivePost(env, toolName, "/v3/dataforseo_labs/google/competitors_domain/live", {
    target,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE,
    limit
  });
}

export function keywordIdeas(env: Env, toolName: string, seedKeywords: string[], limit = 50) {
  return dfsLivePost(env, toolName, "/v3/dataforseo_labs/google/keyword_ideas/live", {
    keywords: seedKeywords,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE,
    limit
  });
}

export function keywordOverview(env: Env, toolName: string, keywords: string[]) {
  return dfsLivePost(env, toolName, "/v3/dataforseo_labs/google/keyword_overview/live", {
    keywords,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE
  });
}

export function domainIntersection(
  env: Env,
  toolName: string,
  target1: string,
  target2: string,
  limit = 100
) {
  return dfsLivePost(env, toolName, "/v3/dataforseo_labs/google/domain_intersection/live", {
    target1,
    target2,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE,
    limit
  });
}
