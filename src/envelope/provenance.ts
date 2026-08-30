import type { Provenance } from "./types";

/** Default confidence per source class, when a tool doesn't compute its own. */
const DEFAULT_CONFIDENCE: Record<Provenance["source_class"], number> = {
  // Your own official data — as authoritative as it gets.
  webmaster_console: 1,
  analytics_property: 1,
  // A crawl you just ran yourself.
  crawl: 0.95,
  // A live SERP snapshot is a real observation, but rankings shift.
  live_serp: 0.85,
  // A cached third-party index — good, but a snapshot, not the source.
  search_index: 0.75,
  backlink_index: 0.7,
  // Whether/what an AI Overview cites is the least deterministic signal.
  ai_answer: 0.5
};

/**
 * Builds a `Provenance` block. `confidence` defaults per source_class but
 * can always be overridden when a caller knows better (e.g. a SERP fact for
 * a feature that flickers a lot).
 */
export function provenance(
  sourceClass: Provenance["source_class"],
  method: string,
  opts: { confidence?: number; observedAt?: Date; cacheHit?: boolean } = {}
): Provenance {
  return {
    source_class: sourceClass,
    method,
    confidence: opts.confidence ?? DEFAULT_CONFIDENCE[sourceClass],
    observed_at: (opts.observedAt ?? new Date()).toISOString(),
    cache_hit: opts.cacheHit ?? false
  };
}
