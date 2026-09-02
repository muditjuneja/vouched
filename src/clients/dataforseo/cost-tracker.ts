import { sendAdminAlert } from "../../lib/alerts";
import type { Env } from "../../types/env";

/**
 * `tenantId` defaults to `null` (self-host, unscoped — matches M0-M9
 * behavior exactly). M14 passes the real tenant id for cloud-mode calls so
 * the daily-spend check below becomes per-tenant instead of global, ahead
 * of real quota enforcement against the `usage_counters` table.
 */
export async function recordCost(
  env: Env,
  toolName: string,
  endpoint: string,
  costUsd: number,
  tenantId: string | null = null
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO cost_log (tool_name, endpoint, cost_usd, tenant_id) VALUES (?1, ?2, ?3, ?4)"
  )
    .bind(toolName, endpoint, costUsd, tenantId)
    .run();

  const budget = env.DATAFORSEO_DAILY_BUDGET_USD ? Number(env.DATAFORSEO_DAILY_BUDGET_USD) : null;
  if (!budget || Number.isNaN(budget)) return;

  const total = await todaysCostUsd(env, tenantId);
  if (total > budget) {
    // A warning, not a hard stop, per the plan — this server never silently
    // blocks a call the caller asked for over a cost heuristic. (Cloud
    // mode's actual quota enforcement, M14, is a separate, harder check
    // against usage_counters — this stays the soft self-host warning.)
    await sendAdminAlert(
      env,
      `DataForSEO daily spend $${total.toFixed(4)} exceeds DATAFORSEO_DAILY_BUDGET_USD ($${budget})` +
        (tenantId ? ` (tenant ${tenantId})` : "")
    );
  }
}

export async function todaysCostUsd(env: Env, tenantId: string | null = null): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(cost_usd), 0) AS total FROM cost_log WHERE called_at >= datetime('now', 'start of day') AND tenant_id IS ?1"
  )
    .bind(tenantId)
    .first<{ total: number }>();
  return row?.total ?? 0;
}
