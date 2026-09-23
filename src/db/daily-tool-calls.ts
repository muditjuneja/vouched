/** The current UTC day as "YYYY-MM-DD", the key the daily cap resets on. */
export function currentDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Counts one tool call against today's cap and reports whether it's still
 * within it. Increment-then-check in a single statement (RETURNING), so two
 * concurrent calls can never both see the same count. A call rejected for
 * being over the cap still increments, which is harmless: the tenant is
 * already over for the day.
 */
export async function consumeDailyToolCall(
  db: D1Database,
  tenantId: string,
  cap: number,
  now: Date = new Date()
): Promise<{ allowed: boolean; used: number }> {
  const row = await db
    .prepare(
      `INSERT INTO daily_tool_calls (tenant_id, day, count) VALUES (?1, ?2, 1)
       ON CONFLICT (tenant_id, day) DO UPDATE SET count = count + 1
       RETURNING count`
    )
    .bind(tenantId, currentDay(now))
    .first<{ count: number }>();
  const used = row?.count ?? 0;
  return { allowed: used <= cap, used };
}
