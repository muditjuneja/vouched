/**
 * Generic short-TTL response cache on top of the CACHE KV binding (see
 * wrangler.jsonc). One shared namespace across tools: each caller picks its
 * own key prefix (e.g. "gsc:...") rather than provisioning a namespace per
 * tool, the same way the DATASETS R2 bucket is already shared and prefixed.
 */
export async function getOrSetCache<T>(
  kv: KVNamespace,
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<{ value: T; cacheHit: boolean }> {
  const cached = await kv.get<T>(key, "json");
  if (cached !== null) return { value: cached, cacheHit: true };

  const value = await compute();
  // KV's minimum expirationTtl is 60s; never let a caller's own smaller TTL
  // silently reject the write.
  await kv.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSeconds) });
  return { value, cacheHit: false };
}
