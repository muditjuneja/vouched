import type { Env } from "../../../types/env";
import { dfsLiveItems, dfsLivePage, dfsLivePost } from "../client";

/** Field names used by the tools are confirmed against the responses in test/fixtures/dataforseo/. */

export function backlinksSummary(env: Env, toolName: string, target: string) {
  return dfsLivePost(env, toolName, "/v3/backlinks/summary/live", { target });
}

export function referringDomains<T = unknown>(env: Env, toolName: string, target: string, limit = 50) {
  return dfsLivePage<T>(env, toolName, "/v3/backlinks/referring_domains/live", { target, limit });
}

export function anchors<T = unknown>(env: Env, toolName: string, target: string, limit = 50) {
  return dfsLivePage<T>(env, toolName, "/v3/backlinks/anchors/live", { target, limit });
}

export function backlinksList<T = unknown>(env: Env, toolName: string, target: string, limit = 50) {
  return dfsLivePage<T>(env, toolName, "/v3/backlinks/backlinks/live", { target, limit, mode: "as_is" });
}

/**
 * Sites that link to `competitor` but not to `excludeDomain`: the link gap.
 * Each row is a referring domain, keyed by target number in
 * `domain_intersection["1"]` (`target` there is the referring domain).
 */
export function backlinksDomainIntersection(env: Env, toolName: string, competitor: string, excludeDomain: string, limit = 100) {
  return dfsLiveItems(env, toolName, "/v3/backlinks/domain_intersection/live", {
    targets: { 1: competitor },
    exclude_targets: [excludeDomain],
    limit
  });
}
