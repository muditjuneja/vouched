import type { Env } from "../../../types/env";
import { dfsLivePost } from "../client";
import { DEFAULT_LOCATION_CODE } from "../locations";

/**
 * ⚠️ Lowest-confidence wrapper in this codebase. AI Optimization / LLM
 * Mentions is DataForSEO's newest product area (recently renamed —
 * `search_mentions`/`top_mentioned_domains` replaced older endpoint names
 * per DataForSEO's own changelog). Only the endpoint *paths* and general
 * shape ("multi-target analysis for domains/brands/products/keywords",
 * a `platform` of `google` or `chat_gpt`) were confirmed this session —
 * request/response *field names* below are a best-effort guess, not
 * verified against docs or a live call. Spike this against the real API
 * before relying on it; expect to revise the request body shape.
 */

export type LlmPlatform = "google" | "chat_gpt";

export function topMentionedDomains(
  env: Env,
  toolName: string,
  topic: string,
  platform: LlmPlatform = "google",
  limit = 20
) {
  return dfsLivePost(env, toolName, "/v3/ai_optimization/llm_mentions/top_mentioned_domains/live/", {
    keyword: topic,
    platform,
    location_code: DEFAULT_LOCATION_CODE,
    limit
  });
}

export function searchMentions(
  env: Env,
  toolName: string,
  targets: string[],
  platform: LlmPlatform = "google",
  limit = 20
) {
  return dfsLivePost(env, toolName, "/v3/ai_optimization/llm_mentions/search_mentions/live/", {
    targets,
    platform,
    location_code: DEFAULT_LOCATION_CODE,
    limit
  });
}
