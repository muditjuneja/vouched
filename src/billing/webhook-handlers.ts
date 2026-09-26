import { Webhooks } from "@dodopayments/hono";
import { creditWallet, upsertSubscription, type Plan, type SubscriptionStatus } from "../db/subscriptions";
import {
  notifyPaymentFailed,
  notifyPaymentReceipt,
  notifySubscriptionCancelled,
  notifyWalletTopup
} from "../email/notifications";
import { sendOnce } from "../email/dedup";
import { sendAdminAlert } from "../lib/alerts";
import type { Env } from "../types/env";

/**
 * Every Subscription* webhook payload is `{ type: "subscription.<event>",
 * data: {...} }`, confirmed by TypeScript itself against
 * @dodopayments/core's actual generated schema types (an earlier version
 * of this file assumed the fields sat flat at the top level; tsc's
 * "missing properties" error against the real type caught the mistake
 * before it ever ran). `data` carries subscription_id/product_id/status/
 * next_billing_date/customer/metadata across every event variant.
 */
/** Exported for unit testing: lets tests build a payload without a real Dodo webhook. */
export interface SubscriptionWebhookPayload {
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
  // create checkouts for our own configured products); default to free
  // rather than guessing, so an unexpected product never silently grants
  // paid access.
  return "free";
}

/** Exported for unit testing without a real Dodo webhook payload. Returns the resolved tenant id (or null if the payload had none), so callers can send a tenant-facing email without re-deriving it. */
export async function syncSubscription(env: Env, payload: SubscriptionWebhookPayload): Promise<string | null> {
  const { data } = payload;
  const tenantId = tenantIdFromMetadata(data.metadata);
  if (!tenantId) {
    console.warn(
      `[dodo webhook] subscription ${data.subscription_id} has no tenant_id in metadata, ignoring`
    );
    return null;
  }

  await upsertSubscription(env.DB, {
    tenantId,
    dodoCustomerId: data.customer.customer_id,
    dodoSubscriptionId: data.subscription_id,
    plan: planFromProductId(env, data.product_id),
    status: data.status,
    currentPeriodEnd: new Date(data.next_billing_date).toISOString()
  });
  return tenantId;
}

// One named function per Dodo event below (rather than inline arrows in
// buildDodoWebhookHandler) so each is independently unit-testable, see
// test/unit/billing/webhook-handlers.test.ts, which mocks src/email/
// notifications.ts and asserts these call the right sender.

/**
 * Dodo retries a delivery that doesn't get a quick 2xx, and a failed charge
 * usually arrives as on_hold and then failed. The subscription sync above is
 * safe to repeat; the customer email isn't, so each one is sent once per
 * subscription and billing period (per plan, for receipts, so a plan change
 * still gets its own).
 */
async function onceFor(env: Env, tenantId: string, key: string, send: () => Promise<boolean>): Promise<void> {
  await sendOnce(env.DB, tenantId, key, send);
}

/** Exported for unit testing. */
export async function handleSubscriptionActive(env: Env, payload: SubscriptionWebhookPayload): Promise<void> {
  const tenantId = await syncSubscription(env, payload);
  const { subscription_id, product_id, next_billing_date } = payload.data;
  if (tenantId) {
    await onceFor(env, tenantId, `receipt:${subscription_id}:${product_id}:${next_billing_date}`, () =>
      notifyPaymentReceipt(env, tenantId, planFromProductId(env, product_id))
    );
  }
}

/** Exported for unit testing. Same as onSubscriptionActive: a renewal is also a successful payment. */
export const handleSubscriptionRenewed = handleSubscriptionActive;

/** Exported for unit testing. */
export async function handleSubscriptionOnHold(env: Env, payload: SubscriptionWebhookPayload): Promise<void> {
  const tenantId = await syncSubscription(env, payload);
  if (tenantId) {
    await onceFor(env, tenantId, `payment_failed:${payload.data.subscription_id}:${payload.data.next_billing_date}`, () => notifyPaymentFailed(env, tenantId));
  }
  // Operator-facing side of the same event, alongside the tenant email above.
  await sendAdminAlert(env, `Dodo subscription ${payload.data.subscription_id} went on_hold`);
}

/** Exported for unit testing. */
export async function handleSubscriptionCancelled(env: Env, payload: SubscriptionWebhookPayload): Promise<void> {
  const tenantId = await syncSubscription(env, payload);
  if (tenantId) {
    await onceFor(env, tenantId, `cancelled:${payload.data.subscription_id}`, () => notifySubscriptionCancelled(env, tenantId));
  }
}

/** Exported for unit testing. */
export async function handleSubscriptionFailed(env: Env, payload: SubscriptionWebhookPayload): Promise<void> {
  const tenantId = await syncSubscription(env, payload);
  if (tenantId) {
    await onceFor(env, tenantId, `payment_failed:${payload.data.subscription_id}:${payload.data.next_billing_date}`, () => notifyPaymentFailed(env, tenantId));
  }
  await sendAdminAlert(env, `Dodo subscription ${payload.data.subscription_id} failed`);
}

/**
 * A one-time Dodo payment's webhook payload, much wider in reality
 * (Dodo's own `Payment` schema carries dozens of fields), narrowed to
 * just what handlePaymentSucceeded reads. Amounts are in the smallest
 * unit of `currency` (cents for USD); `total_amount` includes `tax`.
 */
export interface PaymentWebhookPayload {
  type: string;
  data: {
    payment_id: string;
    total_amount: number;
    currency?: string;
    tax?: number | null;
    settlement_amount?: number;
    settlement_currency?: string;
    settlement_tax?: number | null;
    product_cart?: Array<{ product_id: string; quantity: number }> | null;
    customer: { customer_id: string };
    metadata?: Record<string, unknown>;
  };
}

/** Paid amounts within this share of the credit count as paid in full: card-currency rounding and conversion, never a discount (checkout blocks those). */
const PAID_IN_FULL_RATIO = 0.95;

/** What the customer paid before tax, in US cents, or null when the payment names no USD amount to check. */
function paidUsdCentsBeforeTax(data: PaymentWebhookPayload["data"]): number | null {
  if (data.currency === "USD") return data.total_amount - (data.tax ?? 0);
  if (data.settlement_currency === "USD" && typeof data.settlement_amount === "number") {
    return data.settlement_amount - (data.settlement_tax ?? 0);
  }
  return null;
}

/**
 * How much credit a top-up payment buys, in USD. The wallet gets the
 * top-up's own price (set by our server at checkout, in metadata), not
 * the card total: with tax-exclusive prices that total includes tax, and
 * with local-currency pricing it isn't in dollars at all. The price is
 * checked against what was actually paid before tax, so a payment that
 * came up short credits only what was paid. Exported for unit testing.
 */
export function topupCreditUsd(data: PaymentWebhookPayload["data"]): number {
  const paidCents = paidUsdCentsBeforeTax(data);
  const priced = Number(data.metadata?.credit_usd);
  // Checkouts created before credit_usd existed: fall back to what was paid.
  if (!Number.isFinite(priced) || priced <= 0) return paidCents === null ? 0 : Math.max(0, paidCents) / 100;
  if (paidCents === null || paidCents >= priced * 100 * PAID_IN_FULL_RATIO) return priced;
  return Math.max(0, paidCents) / 100;
}

/**
 * Exported for unit testing. Dodo fires payment.succeeded both for a
 * wallet top-up (src/billing/dodo-client.ts's startWalletTopup) and for
 * every subscription's periodic invoice: the latter is already fully
 * handled by the subscription.* events above and must never also credit
 * the wallet, so this only acts when the payment's cart actually
 * contains the wallet top-up product.
 */
export async function handlePaymentSucceeded(env: Env, payload: PaymentWebhookPayload): Promise<void> {
  const { data } = payload;
  const isWalletTopup = Boolean(env.DODO_PRODUCT_ID_WALLET_TOPUP) && (data.product_cart ?? []).some((item) => item.product_id === env.DODO_PRODUCT_ID_WALLET_TOPUP);
  if (!isWalletTopup) return; // a subscription invoice payment, nothing to do here

  const tenantId = tenantIdFromMetadata(data.metadata);
  if (!tenantId) {
    console.warn(`[dodo webhook] wallet top-up payment ${data.payment_id} has no tenant_id in metadata, ignoring`);
    return;
  }

  const amountUsd = topupCreditUsd(data);
  if (amountUsd <= 0) {
    // Nothing was paid (a 100% discount on an old checkout): no credit, no "credited" email.
    await sendAdminAlert(env, `Dodo wallet top-up ${data.payment_id} for ${tenantId} paid nothing, so nothing was credited`);
    return;
  }
  const credited = await creditWallet(env.DB, tenantId, amountUsd, data.payment_id);
  if (credited) {
    await notifyWalletTopup(env, tenantId, amountUsd);
  }
  // credited === false means this payment_id was already applied (a
  // retried webhook delivery); a silent no-op is correct, not an error.
}

/**
 * Built fresh per request, closing over this request's `env`: same
 * pattern as buildMcpServer, for the same reason: Dodo's Webhooks(config)
 * is constructed once and has no other way to reach D1.
 */
export function buildDodoWebhookHandler(env: Env) {
  return Webhooks({
    webhookKey: env.DODO_WEBHOOK_SECRET ?? "",
    onSubscriptionActive: (payload) => handleSubscriptionActive(env, payload),
    onSubscriptionRenewed: (payload) => handleSubscriptionRenewed(env, payload),
    onSubscriptionOnHold: (payload) => handleSubscriptionOnHold(env, payload),
    onSubscriptionPaused: async (payload) => {
      await syncSubscription(env, payload);
    },
    onSubscriptionUnpaused: async (payload) => {
      await syncSubscription(env, payload);
    },
    onSubscriptionCancelled: (payload) => handleSubscriptionCancelled(env, payload),
    onSubscriptionFailed: (payload) => handleSubscriptionFailed(env, payload),
    onSubscriptionExpired: async (payload) => {
      await syncSubscription(env, payload);
    },
    onPaymentSucceeded: (payload) => handlePaymentSucceeded(env, payload)
  });
}
