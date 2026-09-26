import { FREE_DAILY_TOOL_CALLS } from "../billing/quotas";
import { consumeDailyToolCall } from "../db/daily-tool-calls";
import type { Plan } from "../db/subscriptions";
import type { Env } from "../types/env";

/**
 * Counts one tool call against the free tier's daily cap. Returns an error
 * message when the call should be refused, null when it can go ahead.
 *
 * Counts tool calls, not raw /mcp requests: an MCP session also sends
 * initialize, notifications and tools/list over the same endpoint, and
 * those shouldn't eat a free user's allowance. Paid plans and self-host
 * (no tenant, no plan) are never capped here.
 */
export async function checkDailyCap(env: Env, tenantId: string | null, plan: Plan | null): Promise<string | null> {
  if (!tenantId || plan !== "free") return null;
  const { allowed } = await consumeDailyToolCall(env.DB, tenantId, FREE_DAILY_TOOL_CALLS);
  if (allowed) return null;
  return `daily_limit_exceeded: the free plan allows ${FREE_DAILY_TOOL_CALLS} tool calls per day (resets 00:00 UTC).`;
}
