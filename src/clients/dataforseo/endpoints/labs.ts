import type { Env } from "../../../types/env";
import { dfsLiveItems, dfsLivePage } from "../client";
import { DEFAULT_LANGUAGE_CODE, DEFAULT_LOCATION_CODE } from "../locations";

/**
 * Every function here returns the endpoint's rows (`result[0].items`, see
 * dfsLiveItems). Field names used by the tools are confirmed against the
 * responses saved in test/fixtures/dataforseo/.
 */

export function domainRankOverview(env: Env, toolName: string, target: string) {
  return dfsLiveItems(env, toolName, "/v3/dataforseo_labs/google/domain_rank_overview/live", {
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
  return dfsLiveItems(env, toolName, "/v3/dataforseo_labs/google/ranked_keywords/live", {
    target,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE,
    limit: opts.limit ?? 50,
    ...(opts.filters ? { filters: opts.filters } : {})
  });
}

/** ranked_keywords with its total: how many keywords rank in all (for a page count), not just the rows fetched. */
export function rankedKeywordsPage(
  env: Env,
  toolName: string,
  target: string,
  opts: { limit?: number; filters?: unknown[] } = {}
) {
  return dfsLivePage(env, toolName, "/v3/dataforseo_labs/google/ranked_keywords/live", {
    target,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE,
    limit: opts.limit ?? 50,
    ...(opts.filters ? { filters: opts.filters } : {})
  });
}

export function competitorsDomain(env: Env, toolName: string, target: string, limit = 20) {
  return dfsLiveItems(env, toolName, "/v3/dataforseo_labs/google/competitors_domain/live", {
    target,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE,
    limit
  });
}

export function keywordIdeas(env: Env, toolName: string, seedKeywords: string[], limit = 50) {
  return dfsLiveItems(env, toolName, "/v3/dataforseo_labs/google/keyword_ideas/live", {
    keywords: seedKeywords,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE,
    limit,
    order_by: ["keyword_info.search_volume,desc"]
  });
}

/** Searches that contain the seed phrase ("transactional email api" -> "best transactional email api"). One seed per request. */
export function keywordSuggestions(env: Env, toolName: string, seedKeyword: string, limit = 50) {
  return dfsLiveItems(env, toolName, "/v3/dataforseo_labs/google/keyword_suggestions/live", {
    keyword: seedKeyword,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE,
    limit,
    order_by: ["keyword_info.search_volume,desc"]
  });
}

export function keywordOverview(env: Env, toolName: string, keywords: string[]) {
  return dfsLiveItems(env, toolName, "/v3/dataforseo_labs/google/keyword_overview/live", {
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
  limit = 100,
  opts: { maxTarget1Position?: number } = {}
) {
  // intersections: false returns keywords target1 ranks for and target2
  // doesn't: the gap. Without it the endpoint returns shared keywords.
  // Highest search volume first; optionally only where target1 ranks well.
  return dfsLiveItems(env, toolName, "/v3/dataforseo_labs/google/domain_intersection/live", {
    target1,
    target2,
    intersections: false,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE,
    limit,
    order_by: ["keyword_data.keyword_info.search_volume,desc"],
    ...(opts.maxTarget1Position ? { filters: ["first_domain_serp_element.rank_group", "<=", opts.maxTarget1Position] } : {})
  });
}
