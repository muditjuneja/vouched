import { createCheckoutSession } from "@dodopayments/core/checkout";
import { DodoPayments } from "dodopayments";
import { ConfigError, UpstreamError } from "../lib/errors";
import type { Env } from "../types/env";
import type { Plan } from "../db/subscriptions";
import { MIN_TOPUP_USD } from "./quotas";

type PaidPlan = Exclude<Plan, "free">;

function dodoEnvironment(env: Env): "live_mode" | "test_mode" {
  return env.DODO_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
}

function productIdForPlan(env: Env, plan: PaidPlan): string | null {
  return plan === "pro" ? (env.DODO_PRODUCT_ID_PRO ?? null) : (env.DODO_PRODUCT_ID_TEAM ?? null);
}

export interface StartCheckoutInput {
  plan: PaidPlan;
  tenantId: string;
  customerEmail: string;
  returnUrl: string;
}

/**
 * Creates a Dodo checkout session for a plan upgrade and returns its hosted
 * checkout URL. `tenant_id` rides through in `metadata`, the same field
 * comes back on every subscription/payment webhook event, which is how
 * src/billing/webhook-handlers.ts resolves which tenant a webhook is for.
 */
export async function startCheckout(env: Env, input: StartCheckoutInput): Promise<string> {
  if (!env.DODO_API_KEY) {
    throw new ConfigError("Dodo Payments is not configured (DODO_API_KEY)");
  }
  const productId = productIdForPlan(env, input.plan);
  if (!productId) {
    throw new ConfigError(`no Dodo product id configured for the "${input.plan}" plan`);
  }

  const session = await createCheckoutSession(
    {
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: input.customerEmail },
      return_url: input.returnUrl,
      metadata: { tenant_id: input.tenantId }
    },
    { bearerToken: env.DODO_API_KEY, environment: dodoEnvironment(env) }
  );

  if (!session.checkout_url) {
    throw new UpstreamError("dodo", "checkout session created without a checkout_url");
  }
  return session.checkout_url;
}

/**
 * A hosted Dodo "customer portal" session URL for an already-resolved
 * Dodo customer id, letting a tenant manage/cancel their own subscription
 * or view invoices without us building any of that UI ourselves.
 *
 * Deliberately not the vendored @dodopayments/hono `CustomerPortal`
 * handler: that handler takes a bare `customer_id` from the request's own
 * query string with no session/ownership check at all (confirmed against
 * its source), which would let any caller view/manage another tenant's
 * billing portal by guessing an id. Callers of this function must resolve
 * `dodoCustomerId` from the requesting tenant's own subscriptions row
 * first (see src/index.ts's /billing/portal route), never from client
 * input directly.
 */
export async function startCustomerPortalSession(env: Env, dodoCustomerId: string): Promise<string> {
  if (!env.DODO_API_KEY) {
    throw new ConfigError("Dodo Payments is not configured (DODO_API_KEY)");
  }
  const client = new DodoPayments({ bearerToken: env.DODO_API_KEY, environment: dodoEnvironment(env) });
  const session = await client.customers.customerPortal.create(dodoCustomerId, { send_email: false });
  return session.link;
}

export interface StartWalletTopupInput {
  tenantId: string;
  customerEmail: string;
  amountUsd: number;
  returnUrl: string;
}

/**
 * One-time (non-subscription) checkout that credits a tenant's prepaid
 * overage wallet (src/db/subscriptions.ts's wallet_balance_usd) once
 * Dodo's payment.succeeded webhook fires, see
 * src/billing/webhook-handlers.ts's handlePaymentSucceeded. Uses a single
 * "pay what you want" product configured once in the Dodo dashboard
 * (DODO_PRODUCT_ID_WALLET_TOPUP), with its price overridden per checkout
 * via `product_cart[].amount`, a real field on Dodo's own checkout
 * session schema (@dodopayments/core's checkoutSessionProductCartItemSchema),
 * confirmed to exist, but the unit it expects is not: assumed here to be
 * the smallest currency unit (USD cents), matching the Stripe-style
 * convention Dodo's API otherwise follows, since neither this vendored
 * SDK nor its bundled docs state the unit explicitly. Confirm against a
 * real top-up before trusting the charged amount matches what's shown on
 * the dashboard's "buy credits" form.
 *
 * Dodo also has its own native subscription-attached credit/overage
 * system (credit.added/credit.deducted/CreditBalanceLow/
 * CreditOverageCharged webhooks) that could replace this whole wallet,
 * not adopted here since it needs per-product credit-entitlement
 * configuration this sandbox has no live account to verify against.
 */
export async function startWalletTopup(env: Env, input: StartWalletTopupInput): Promise<string> {
  if (!env.DODO_API_KEY) {
    throw new ConfigError("Dodo Payments is not configured (DODO_API_KEY)");
  }
  if (!env.DODO_PRODUCT_ID_WALLET_TOPUP) {
    throw new ConfigError("no Dodo product id configured for wallet top-ups (DODO_PRODUCT_ID_WALLET_TOPUP)");
  }
  if (!Number.isFinite(input.amountUsd) || input.amountUsd < MIN_TOPUP_USD) {
    throw new ConfigError(`top-up amount must be at least $${MIN_TOPUP_USD}`);
  }

  const session = await createCheckoutSession(
    {
      product_cart: [{ product_id: env.DODO_PRODUCT_ID_WALLET_TOPUP, quantity: 1, amount: Math.round(input.amountUsd * 100) }],
      customer: { email: input.customerEmail },
      return_url: input.returnUrl,
      // credit_usd is what the wallet gets: the top-up's price, before tax
      // and in USD, whatever the card was charged (see handlePaymentSucceeded).
      metadata: { tenant_id: input.tenantId, purpose: "wallet_topup", credit_usd: input.amountUsd.toFixed(2) },
      // A discount would buy credit for less than it's worth.
      feature_flags: { allow_discount_code: false }
    },
    { bearerToken: env.DODO_API_KEY, environment: dodoEnvironment(env) }
  );

  if (!session.checkout_url) {
    throw new UpstreamError("dodo", "checkout session created without a checkout_url");
  }
  return session.checkout_url;
}
