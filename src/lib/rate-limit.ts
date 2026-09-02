export const DEFAULT_LIMIT_PER_MINUTE = 60;

/** The current UTC minute as a bucket key, e.g. "2026-09-02T23:11". */
export function currentMinuteBucket(now: Date = new Date()): string {
  return now.toISOString().slice(0, 16);
}

/**
 * Fixed-window per-tenant rate limit, backed by D1 (see the doc comment on
 * migrations/0004_hardening.sql for why not Cloudflare's native Rate
 * Limiting binding). Increments first, then checks — a burst that lands
 * exactly on the limit is allowed once more than a strict pre-check would
 * allow, which is an acceptable trade-off for a fixed window and avoids a
 * second round trip.
 */
export async function checkAndIncrementRateLimit(
  db: D1Database,
  tenantId: string,
  limitPerMinute: number = DEFAULT_LIMIT_PER_MINUTE,
  now: Date = new Date()
): Promise<boolean> {
  const bucket = currentMinuteBucket(now);

  await db
    .prepare(
      `INSERT INTO rate_limit_buckets (tenant_id, bucket, count) VALUES (?1, ?2, 1)
       ON CONFLICT (tenant_id, bucket) DO UPDATE SET count = count + 1`
    )
    .bind(tenantId, bucket)
    .run();

  const row = await db
    .prepare("SELECT count FROM rate_limit_buckets WHERE tenant_id = ?1 AND bucket = ?2")
    .bind(tenantId, bucket)
    .first<{ count: number }>();

  return (row?.count ?? 0) <= limitPerMinute;
}
