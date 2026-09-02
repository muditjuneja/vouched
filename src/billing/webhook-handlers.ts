import { Webhooks } from "@dodopayments/hono";
import { upsertSubscription, type Plan, type SubscriptionStatus } from "../db/subscriptions";
import type { Env } from "../types/env";

/**
 * Every Subscription* webhook payload is `{ type: "subscription.<event>",
 * data: {...} }` — confirmed by TypeScript itself against
 * @dodopayments/core's actual generated schema types (an earlier version
 * of this file assumed the fields sat flat at the top level; tsc's
 * "missing properties" error against the real type caught the mistake
 * before it ever ran). `data` carries subscription_id/product_id/status/
 * next_billing_date/customer/metadata across every event variant.
 */
interface SubscriptionWebhookPayload {
  type: string;
  data: {
    subscription_id: string;
    product_id: string;
    status: SubscriptionStatus;
    next_billing_date: string | Date;
    customer: { customer_id: string };
    metadata?: Record<string, unknown>;
  };
}

/** Exported for unit testing without a real Dodo webhook payload. */
export function tenantIdFromMetadata(metadata: Record<string, unknown> | undefined): string | null {
  const value = metadata?.tenant_id;
  return typeof value === "string" ? value : null;
}

/** Exported for unit testing without a real Dodo webhook payload. */
export function planFromProductId(env: Env, productId: string): Plan {
  if (productId === env.DODO_PRODUCT_ID_TEAM) return "team";
  if (productId === env.DODO_PRODUCT_ID_PRO) return "pro";
  // Unrecognized product id shouldn't happen in practice (we only ever
  // create checkouts for our own configured products) — default to free
  // rather than guessing, so an unexpected product never silently grants
  // paid access.
  return "free";
}

async function syncSubscription(env: Env, payload: SubscriptionWebhookPayload): Promise<void> {
  const { data } = payload;
  const tenantId = tenantIdFromMetadata(data.metadata);
  if (!tenantId) {
    console.warn(
      `[dodo webhook] subscription ${data.subscription_id} has no tenant_id in metadata — ignoring`
    );
    return;
  }

  await upsertSubscription(env.DB, {
    tenantId,
    dodoCustomerId: data.customer.customer_id,
    dodoSubscriptionId: data.subscription_id,
    plan: planFromProductId(env, data.product_id),
    status: data.status,
    currentPeriodEnd: new Date(data.next_billing_date).toISOString()
  });
}

/**
 * Built fresh per request, closing over this request's `env` — same
 * pattern as buildMcpServer, for the same reason: Dodo's Webhooks(config)
 * is constructed once and has no other way to reach D1.
 */
export function buildDodoWebhookHandler(env: Env) {
  return Webhooks({
    webhookKey: env.DODO_WEBHOOK_SECRET ?? "",
    onSubscriptionActive: (payload) => syncSubscription(env, payload),
    onSubscriptionRenewed: (payload) => syncSubscription(env, payload),
    onSubscriptionOnHold: (payload) => syncSubscription(env, payload),
    onSubscriptionPaused: (payload) => syncSubscription(env, payload),
    onSubscriptionUnpaused: (payload) => syncSubscription(env, payload),
    onSubscriptionCancelled: (payload) => syncSubscription(env, payload),
    onSubscriptionFailed: (payload) => syncSubscription(env, payload),
    onSubscriptionExpired: (payload) => syncSubscription(env, payload)
  });
}
