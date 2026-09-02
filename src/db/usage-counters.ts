export interface UsageCounterRow {
  tenant_id: string;
  period: string; // "YYYY-MM"
  calls_used: number;
  cost_incurred_usd: number;
  updated_at: string;
}

/** The current UTC month as "YYYY-MM" — the period key usage_counters resets on. */
export function currentPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export async function getUsage(
  db: D1Database,
  tenantId: string,
  period: string = currentPeriod()
): Promise<UsageCounterRow | null> {
  const row = await db
    .prepare("SELECT * FROM usage_counters WHERE tenant_id = ?1 AND period = ?2")
    .bind(tenantId, period)
    .first<UsageCounterRow>();
  return row ?? null;
}

/** Atomically increments the current period's counters by one call's cost. */
export async function recordUsage(
  db: D1Database,
  tenantId: string,
  costUsd: number,
  period: string = currentPeriod()
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usage_counters (tenant_id, period, calls_used, cost_incurred_usd, updated_at)
       VALUES (?1, ?2, 1, ?3, datetime('now'))
       ON CONFLICT (tenant_id, period) DO UPDATE SET
         calls_used = calls_used + 1,
         cost_incurred_usd = cost_incurred_usd + excluded.cost_incurred_usd,
         updated_at = datetime('now')`
    )
    .bind(tenantId, period, costUsd)
    .run();
}
