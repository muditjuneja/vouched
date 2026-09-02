/**
 * Backs every M18 notification's dedup logic against a single small table
 * (`tenant_notifications` — migrations/0005_email_notifications.sql).
 * Two shapes cover every hook point in this build:
 * - "send exactly once, ever" for a given key (welcome email; quota
 *   warnings, whose key already encodes the billing period so it also
 *   naturally resets every period without any time math here).
 * - "send at most once per cooldown window" for a genuinely recurring
 *   condition (the Google reconnect nudge).
 */

/**
 * Returns true (send it) only the first time `noticeKey` is ever seen for
 * this tenant; every later call for the same key returns false. Relies on
 * the table's (tenant_id, notice_key) primary key — `INSERT OR IGNORE`
 * either inserts (first time) or no-ops (already sent), and `meta.changes`
 * tells the two apart without a separate SELECT.
 */
export async function markNotifiedOnce(db: D1Database, tenantId: string, noticeKey: string): Promise<boolean> {
  const result = await db
    .prepare("INSERT OR IGNORE INTO tenant_notifications (tenant_id, notice_key) VALUES (?1, ?2)")
    .bind(tenantId, noticeKey)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * Returns true (send it) if `noticeKey` was never sent for this tenant, or
 * was last sent more than `cooldownHours` ago — and stamps `sent_at` to
 * `now` in that same case. A recurring condition (still reconnect_required
 * on the next dashboard load, say) should eventually re-notify, unlike
 * markNotifiedOnce's "ever" semantics.
 */
export async function markNotifiedWithCooldown(
  db: D1Database,
  tenantId: string,
  noticeKey: string,
  cooldownHours: number,
  now: Date = new Date()
): Promise<boolean> {
  const row = await db
    .prepare("SELECT sent_at FROM tenant_notifications WHERE tenant_id = ?1 AND notice_key = ?2")
    .bind(tenantId, noticeKey)
    .first<{ sent_at: string }>();

  if (row) {
    // sent_at here is always one this function itself wrote (below, as a
    // full ISO string) — markNotifiedOnce's disjoint notice_key namespace
    // never shares a row with this function's, so there's no other format
    // to account for.
    const elapsedMs = now.getTime() - new Date(row.sent_at).getTime();
    if (elapsedMs < cooldownHours * 60 * 60 * 1000) return false;
  }

  await db
    .prepare(
      `INSERT INTO tenant_notifications (tenant_id, notice_key, sent_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (tenant_id, notice_key) DO UPDATE SET sent_at = excluded.sent_at`
    )
    .bind(tenantId, noticeKey, now.toISOString())
    .run();
  return true;
}
