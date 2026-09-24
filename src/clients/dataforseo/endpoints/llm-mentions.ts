import type { Env } from "../../../types/env";
import { dfsLiveItems, dfsLivePost } from "../client";
import { DEFAULT_LANGUAGE_CODE, DEFAULT_LOCATION_CODE } from "../locations";

/**
 * AI Optimization / LLM Mentions: how often domains are mentioned in AI
 * answers. Request bodies and response fields are confirmed against the
 * sandbox responses in test/fixtures/dataforseo/: `target` is an array of
 * objects (`[{ keyword }]` or `[{ domain }]`), which is what the earlier
 * `keyword`/`targets` guesses got wrong (production answered 40400).
 */

export type LlmPlatform = "google" | "chat_gpt";

export interface MentionCount {
  key: string | number;
  mentions?: number;
  ai_search_volume?: number;
}

/** The domains AI answers mention most for a topic. Each row: `domain` and `total: { mentions, ai_search_volume }`. */
export function topMentionedDomains(env: Env, toolName: string, topic: string, platform: LlmPlatform = "google", limit = 20) {
  return dfsLiveItems(env, toolName, "/v3/ai_optimization/llm_mentions/top_mentioned_domains/live", {
    target: [{ keyword: topic }],
    platform,
    location_code: DEFAULT_LOCATION_CODE,
    language_code: DEFAULT_LANGUAGE_CODE,
    limit
  });
}

/** Mention totals for one domain, broken down by platform, location, language and cited sources. Null when there's no data. */
export async function domainMentionMetrics(
  env: Env,
  toolName: string,
  domain: string,
  platform: LlmPlatform = "google"
): Promise<{ platform?: MentionCount[]; sources_domain?: MentionCount[] } | null> {
  const result = await dfsLivePost<{ aggregated_metrics?: { platform?: MentionCount[]; sources_domain?: MentionCount[] } | null }>(
    env,
    toolName,
    "/v3/ai_optimization/llm_mentions/target_metrics/live",
    { target: [{ domain }], platform, location_code: DEFAULT_LOCATION_CODE, language_code: DEFAULT_LANGUAGE_CODE }
  );
  return result[0]?.aggregated_metrics ?? null;
}
