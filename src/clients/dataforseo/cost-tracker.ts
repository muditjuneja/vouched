import type { Env } from "../../types/env";

export async function recordCost(
  env: Env,
  toolName: string,
  endpoint: string,
  costUsd: number
): Promise<void> {
  await env.DB.prepare("INSERT INTO cost_log (tool_name, endpoint, cost_usd) VALUES (?1, ?2, ?3)")
    .bind(toolName, endpoint, costUsd)
    .run();

  const budget = env.DATAFORSEO_DAILY_BUDGET_USD ? Number(env.DATAFORSEO_DAILY_BUDGET_USD) : null;
  if (!budget || Number.isNaN(budget)) return;

  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(cost_usd), 0) AS total FROM cost_log WHERE called_at >= datetime('now', 'start of day')"
  ).first<{ total: number }>();

  if (row && row.total > budget) {
    // A warning, not a hard stop, per the plan — this server never silently
    // blocks a call the caller asked for over a cost heuristic.
    console.warn(
      `[dataforseo] today's spend $${row.total.toFixed(4)} exceeds DATAFORSEO_DAILY_BUDGET_USD ($${budget})`
    );
  }
}

export async function todaysCostUsd(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(cost_usd), 0) AS total FROM cost_log WHERE called_at >= datetime('now', 'start of day')"
  ).first<{ total: number }>();
  return row?.total ?? 0;
}
