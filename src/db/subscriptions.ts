export type Plan = "free" | "pro" | "team";
export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "expired";

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
 * A tenant with no subscriptions row, or one that isn't `active`
 * (including `past_due`), is treated as the free plan — conservative for
 * now; a grace period for `past_due` before downgrading is a fast-follow
 * once M13's dunning-email flow exists to actually warn the tenant first.
 */
export async function getEffectivePlan(db: D1Database, tenantId: string): Promise<Plan> {
  const row = await getSubscription(db, tenantId);
  if (!row || row.status !== "active") return "free";
  return row.plan;
}
