import { createCheckoutSession } from "@dodopayments/core/checkout";
import { ConfigError, UpstreamError } from "../lib/errors";
import type { Env } from "../types/env";
import type { Plan } from "../db/subscriptions";

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
 * checkout URL. `tenant_id` rides through in `metadata` — the same field
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
