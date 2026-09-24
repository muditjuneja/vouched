import { getOrSetCache } from "../../lib/cache";
import type { Env } from "../../types/env";

/**
 * Shared cache wrapper for every live Search Console call this domain's
 * tools make (get_search_performance's searchAnalytics.query,
 * inspect_indexing's urlInspection.index:inspect, list_sitemaps'
 * sitemaps.list), keyed by tenant plus an exact, caller-built key.
 *
 * The KV entry expires after `ttlSeconds` and that's the only copy kept:
 * users' Search Console data is never archived. Google's Limited Use rules
 * only allow using it to serve the user who asked for it.
 *
 * `fetchedAt` is when Google actually returned the data, kept with the
 * cached copy, so a cache hit reports its real age instead of looking fresh.
 */
export async function cachedGscCall<T>(
  env: Env,
  tenantId: string | null,
  tool: string,
  keyParts: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<{ value: T; cacheHit: boolean; fetchedAt: Date }> {
  // "gsc2": entries carry their fetch time; the older "gsc" ones didn't.
  const key = `gsc2:${tenantId ?? "self-host"}:${keyParts}`;
  const { value: entry, cacheHit } = await getOrSetCache(env.CACHE, key, ttlSeconds, async () => ({
    value: await compute(),
    fetchedAt: new Date().toISOString()
  }));
  return { value: entry.value, cacheHit, fetchedAt: new Date(entry.fetchedAt) };
}
