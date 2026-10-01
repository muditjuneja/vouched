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

/**
 * Whether `url` belongs to a Search Console property, so a URL Inspection
 * call for some other site is caught here rather than coming back as
 * Google's 403. A domain property (sc-domain:example.com) covers the host
 * and every subdomain over either scheme; a URL-prefix property
 * (https://example.com/blog/) covers exactly what starts with it.
 */
export function urlInProperty(url: string, siteUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = parsed.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  return parsed.href.toLowerCase().startsWith(siteUrl.toLowerCase());
}
