import type { Env } from "../../../types/env";
import { dfsLivePost } from "../client";
import { DEFAULT_LANGUAGE_CODE, DEFAULT_LOCATION_CODE } from "../locations";

export function organicSerp(env: Env, toolName: string, keyword: string, depth = 20) {
  return dfsLivePost(env, toolName, "/v3/serp/google/organic/live/advanced", {
    keyword,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE,
    depth
  });
}
