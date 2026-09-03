export type Plan = "free" | "pro" | "team";
/**
 * Dodo Payments' own real subscription status vocabulary, verbatim
 * (confirmed against @dodopayments/core's schema types in M13) — stored
 * as-is rather than translated into an invented internal vocabulary, so a
 * webhook payload's `status` field can be written straight through.
 */
export type SubscriptionStatus =
  | "pending"
  | "active"
  | "on_hold"
  | "paused"
  | "cancelled"
  | "failed"
  | "expired";

export interface SubscriptionRow {
  tenant_id: string;
  dodo_customer_id: string | null;
  dodo_subscription_id: string | null;
  plan: Plan;
  status: SubscriptionStatus;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

/** Cloud-only table — there is no row for a self-host "tenant" (there is no tenant). */
export async function getSubscription(db: D1Database, tenantId: string): Promise<SubscriptionRow | null> {
  const row = await db
    .prepare("SELECT * FROM subscriptions WHERE tenant_id = ?1")
    .bind(tenantId)
    .first<SubscriptionRow>();
  return row ?? null;
}

export interface UpsertSubscriptionInput {
  tenantId: string;
  dodoCustomerId?: string | null;
  dodoSubscriptionId?: string | null;
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodEnd?: string | null;
}

export async function upsertSubscription(db: D1Database, input: UpsertSubscriptionInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO subscriptions (tenant_id, dodo_customer_id, dodo_subscription_id, plan, status, current_period_end, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
       ON CONFLICT (tenant_id) DO UPDATE SET
         dodo_customer_id = excluded.dodo_customer_id,
         dodo_subscription_id = excluded.dodo_subscription_id,
         plan = excluded.plan,
         status = excluded.status,
         current_period_end = excluded.current_period_end,
         updated_at = datetime('now')`
    )
    .bind(
      input.tenantId,
      input.dodoCustomerId ?? null,
      input.dodoSubscriptionId ?? null,
      input.plan,
      input.status,
      input.currentPeriodEnd ?? null
    )
    .run();
}

/**
 * Days past `current_period_end` a payment-failure status (`on_hold` or
 * `failed`) still keeps its paid plan before falling back to free. Gives a
 * tenant time to fix their payment method after Dodo's dunning attempts —
 * coordinated with M18's `notifyPaymentFailed` email, which fires the
 * moment the status changes, so the tenant is warned right when the grace
 * period starts, not left to discover it via a sudden downgrade.
 */
const PAYMENT_FAILURE_GRACE_DAYS = 3;

/**
 * A tenant with no subscriptions row is the free plan. `active` is their
 * real plan. `on_hold`/`failed` (a payment issue, not a deliberate
 * cancellation) keep their real plan for `PAYMENT_FAILURE_GRACE_DAYS`
 * past `current_period_end` — Dodo's own dunning retries plus this grace
 * window give a tenant a real chance to fix their payment method before
 * losing access, rather than a hard cutoff the instant a charge fails.
 * `pending` (never activated), `paused`, `cancelled`, and `expired` are
 * deliberate/terminal states with no ambiguity — free immediately.
 */
export async function getEffectivePlan(db: D1Database, tenantId: string, now: Date = new Date()): Promise<Plan> {
  const row = await getSubscription(db, tenantId);
  if (!row) return "free";
  if (row.status === "active") return row.plan;

  if ((row.status === "on_hold" || row.status === "failed") && row.current_period_end) {
    const graceEndsAt = new Date(row.current_period_end).getTime() + PAYMENT_FAILURE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    if (now.getTime() < graceEndsAt) return row.plan;
  }

  return "free";
}
