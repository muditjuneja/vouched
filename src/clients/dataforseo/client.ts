import { getEffectivePlan } from "../../db/subscriptions";
import { getUsage, recordUsage } from "../../db/usage-counters";
import { QuotaExceededError, UpstreamError } from "../../lib/errors";
import { isCloudMode, type Env } from "../../types/env";
import { MONTHLY_QUOTA_USD } from "../../billing/quotas";
import { recordCost } from "./cost-tracker";
import { bundledDataForSeoAuthHeader, dataForSeoAuthHeader } from "./dataforseo-auth";

const API_BASE = "https://api.dataforseo.com";

interface DfsTask<T> {
  id: string;
  status_code: number;
  status_message: string;
  cost: number;
  result: T[] | null;
}

interface DfsResponse<T> {
  status_code: number;
  status_message: string;
  cost: number;
  tasks?: DfsTask<T>[];
}

/**
 * Calls one DataForSEO `/live/` endpoint (synchronous — one POST returns
 * results directly, per DataForSEO's own docs) with a single task, logs its
 * real cost to D1, and returns that task's `result` array.
 *
 * In cloud mode with a resolved tenant, this uses the deployment's bundled
 * DataForSEO account (never the tenant's own key — cloud has no BYOK path,
 * per the locked-in "bundled access" decision) and enforces that tenant's
 * plan quota first. Self-host and any non-cloud call path is completely
 * unaffected — same BYOK behavior as before this milestone.
 *
 * NOTE: request/response field names here follow DataForSEO's documented
 * conventions, confirmed only via endpoint *paths* (from DataForSEO's own
 * `mcp-server-typescript` field-config, since docs.dataforseo.com itself
 * was unreachable while this was built) — not verified against a real
 * authenticated call, since this build has no DataForSEO API key. Confirm
 * request/response shape against the live API before trusting a new
 * endpoint wrapper built on this client.
 */
export async function dfsLivePost<TResult>(
  env: Env,
  toolName: string,
  path: string,
  task: Record<string, unknown>
): Promise<TResult[]> {
  const tenantId = env.__tenantId ?? null;
  const usingBundled = isCloudMode(env) && tenantId !== null;

  if (usingBundled) {
    const plan = await getEffectivePlan(env.DB, tenantId!);
    const quotaUsd = MONTHLY_QUOTA_USD[plan];
    const usage = await getUsage(env.DB, tenantId!);
    const usedUsd = usage?.cost_incurred_usd ?? 0;
    if (usedUsd >= quotaUsd) {
      throw new QuotaExceededError(plan, quotaUsd);
    }
    // M18 email hook belongs here: warn at e.g. 80%/100% of quotaUsd,
    // debounced so a burst of calls near the threshold doesn't spam.
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: usingBundled ? bundledDataForSeoAuthHeader(env) : dataForSeoAuthHeader(env),
      "content-type": "application/json"
    },
    body: JSON.stringify([task])
  });

  if (!res.ok) {
    throw new UpstreamError("dataforseo", await res.text(), res.status);
  }

  const body = (await res.json()) as DfsResponse<TResult>;
  const task0 = body.tasks?.[0];
  if (!task0 || task0.status_code !== 20000) {
    throw new UpstreamError(
      "dataforseo",
      task0?.status_message ?? body.status_message ?? "no task result returned",
      task0?.status_code ?? body.status_code
    );
  }

  await recordCost(env, toolName, path, task0.cost, tenantId);
  if (usingBundled) {
    await recordUsage(env.DB, tenantId!, task0.cost);
  }
  return task0.result ?? [];
}
