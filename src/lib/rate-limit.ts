export const DEFAULT_LIMIT_PER_MINUTE = 60;

/** How long a bucket sticks around after its minute passes before pruneStaleBuckets deletes it. */
const PRUNE_AFTER_MINUTES = 5;

/** The current UTC minute as a bucket key, e.g. "2026-09-02T23:11". */
export function currentMinuteBucket(now: Date = new Date()): string {
  return now.toISOString().slice(0, 16);
}

/**
 * Deletes this tenant's own buckets older than `PRUNE_AFTER_MINUTES` —
 * `rate_limit_buckets` otherwise grows forever (migrations/0004_hardening.sql
 * flagged this as a fast-follow needing a Cron Trigger, which this build
 * doesn't have). Scoped to the calling tenant so it stays a cheap, indexed
 * point operation on the existing (tenant_id, bucket) primary key, not a
 * full-table sweep. Self-cleaning for every *active* tenant is the actual
 * goal here, not a global sweep: a tenant who calls `/mcp` once and never
 * again leaves a single stale row behind forever — bounded and harmless,
 * an accepted tradeoff rather than a real gap.
 */
async function pruneStaleBuckets(db: D1Database, tenantId: string, now: Date): Promise<void> {
  const cutoff = currentMinuteBucket(new Date(now.getTime() - PRUNE_AFTER_MINUTES * 60_000));
  await db.prepare("DELETE FROM rate_limit_buckets WHERE tenant_id = ?1 AND bucket < ?2").bind(tenantId, cutoff).run();
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

  await pruneStaleBuckets(db, tenantId, now);

  return (row?.count ?? 0) <= limitPerMinute;
}
