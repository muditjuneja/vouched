import type { Env } from "../../../types/env";
import { dfsLivePost } from "../client";

/** Same field-shape caveat as endpoints/labs.ts — paths confirmed, field names not verified live. */

export function backlinksSummary(env: Env, toolName: string, target: string) {
  return dfsLivePost(env, toolName, "/v3/backlinks/summary/live", { target });
}

export function referringDomains(env: Env, toolName: string, target: string, limit = 50) {
  return dfsLivePost(env, toolName, "/v3/backlinks/referring_domains/live", { target, limit });
}

export function anchors(env: Env, toolName: string, target: string, limit = 50) {
  return dfsLivePost(env, toolName, "/v3/backlinks/anchors/live", { target, limit });
}

export function backlinksList(env: Env, toolName: string, target: string, limit = 50) {
  return dfsLivePost(env, toolName, "/v3/backlinks/backlinks/live", { target, limit, mode: "as_is" });
}

export function backlinksDomainIntersection(
  env: Env,
  toolName: string,
  target1: string,
  target2: string,
  limit = 100
) {
  return dfsLivePost(env, toolName, "/v3/backlinks/domain_intersection/live", {
    targets: { 1: target1, 2: target2 },
    limit
  });
}
