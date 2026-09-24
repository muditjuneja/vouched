import { debitWallet, getEffectivePlan, getWalletBalance } from "../../db/subscriptions";
import { currentPeriod, getUsage, recordUsage } from "../../db/usage-counters";
import { markNotifiedWithCooldown, sendOnce } from "../../email/dedup";
import { notifyLowWalletBalance, notifyQuotaWarning } from "../../email/notifications";
import { QuotaExceededError, UpgradeRequiredError, UpstreamError } from "../../lib/errors";
import { isCloudMode, type Env } from "../../types/env";
import { MONTHLY_QUOTA_USD, OVERAGE_MARKUP_MULTIPLIER } from "../../billing/quotas";
import { recordCost } from "./cost-tracker";
import { bundledDataForSeoAuthHeader, dataForSeoAuthHeader } from "./dataforseo-auth";

const API_BASE = "https://api.dataforseo.com";

/** Wallet balance (USD) below which notifyLowWalletBalance fires, at most once per LOW_WALLET_COOLDOWN_HOURS. */
const LOW_WALLET_THRESHOLD_USD = 2;
const LOW_WALLET_COOLDOWN_HOURS = 24;

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
 * Calls one DataForSEO `/live/` endpoint (synchronous: one POST returns
 * results directly, per DataForSEO's own docs) with a single task, logs its
 * real cost to D1, and returns that task's `result` array.
 *
 * In cloud mode with a resolved tenant, this uses the deployment's bundled
 * DataForSEO account (never the tenant's own key: cloud has no BYOK path,
 * per the locked-in "bundled access" decision) and enforces that tenant's
 * plan quota first. Once a tenant is past their bundled quota, a call is
 * still allowed through (rather than blocked) as long as their prepaid
 * overage wallet has a positive balance (see chargeOverage below), and
 * only blocked with QuotaExceededError once both the quota and the wallet
 * are exhausted. Self-host and any non-cloud call path is completely
 * unaffected, same BYOK behavior as before this milestone.
 *
 * NOTE: request/response field names here follow DataForSEO's documented
 * conventions, confirmed only via endpoint *paths* (from DataForSEO's own
 * `mcp-server-typescript` field-config, since docs.dataforseo.com itself
 * was unreachable while this was built), not verified against a real
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
  let overQuota = false;

  if (usingBundled) {
    const plan = await getEffectivePlan(env.DB, tenantId!);
    // Checked before the wallet, not just via the $0 free quota: a tenant
    // who downgraded with wallet balance left must not keep spending it on
    // paid data from a free plan.
    if (plan === "free") throw new UpgradeRequiredError();
    const quotaUsd = MONTHLY_QUOTA_USD[plan];
    const usage = await getUsage(env.DB, tenantId!);
    const usedUsd = usage?.cost_incurred_usd ?? 0;
    overQuota = usedUsd >= quotaUsd;
    if (overQuota && (await getWalletBalance(env.DB, tenantId!)) <= 0) {
      throw new QuotaExceededError(plan, quotaUsd);
    }
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
    throw new UpstreamError("market_data", await res.text(), res.status);
  }

  const body = (await res.json()) as DfsResponse<TResult>;
  const task0 = body.tasks?.[0];
  if (!task0 || task0.status_code !== 20000) {
    throw new UpstreamError(
      "market_data",
      task0?.status_message ?? body.status_message ?? "no task result returned",
      task0?.status_code ?? body.status_code
    );
  }

  await recordCost(env, toolName, path, task0.cost, tenantId);
  if (usingBundled) {
    await recordUsage(env.DB, tenantId!, task0.cost);
    if (overQuota) {
      await chargeOverage(env, tenantId!, task0.cost);
    } else {
      await warnOnQuotaThreshold(env, tenantId!);
    }
  }
  return task0.result ?? [];
}

/**
 * Debits this call's marked-up cost from the tenant's prepaid overage
 * wallet once they're past their plan's bundled quota. The call has
 * already happened and its real cost is already recorded (recordCost/
 * recordUsage above) by the time this runs, so see debitWallet's own doc
 * comment for why an insufficient-balance race here is absorbed rather
 * than retroactively refused. Warns by email once the remaining balance
 * drops under LOW_WALLET_THRESHOLD_USD, debounced the same way the
 * quota-threshold warning below is.
 */
async function chargeOverage(env: Env, tenantId: string, rawCostUsd: number): Promise<void> {
  const overageCostUsd = rawCostUsd * OVERAGE_MARKUP_MULTIPLIER;
  await debitWallet(env.DB, tenantId, overageCostUsd, currentPeriod());

  const remaining = await getWalletBalance(env.DB, tenantId);
  if (remaining < LOW_WALLET_THRESHOLD_USD) {
    if (await markNotifiedWithCooldown(env.DB, tenantId, "low_wallet_balance", LOW_WALLET_COOLDOWN_HOURS)) {
      await notifyLowWalletBalance(env, tenantId, remaining);
    }
  }
}

/**
 * Fires the 80%/100%-of-quota email at most once per threshold per billing
 * period: the notice key itself encodes the period (currentPeriod()), so
 * sendOnce's "ever" semantics naturally reset every month with no
 * time math needed here.
 */
async function warnOnQuotaThreshold(env: Env, tenantId: string): Promise<void> {
  const plan = await getEffectivePlan(env.DB, tenantId);
  const quotaUsd = MONTHLY_QUOTA_USD[plan];
  if (quotaUsd <= 0) return; // free plan has no bundled quota to warn about

  const usage = await getUsage(env.DB, tenantId);
  const usedUsd = usage?.cost_incurred_usd ?? 0;
  const pctUsed = (usedUsd / quotaUsd) * 100;
  const period = currentPeriod();

  const thresholds: Array<80 | 100> = [100, 80]; // check 100 first so a call that jumps straight past 80 still gets the right (higher) notice
  for (const threshold of thresholds) {
    if (pctUsed < threshold) continue;
    await sendOnce(env.DB, tenantId, `quota_warning_${threshold}:${period}`, () => notifyQuotaWarning(env, tenantId, threshold, plan));
    break;
  }
}
