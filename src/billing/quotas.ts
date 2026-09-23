import type { Plan } from "../db/subscriptions";

/**
 * Monthly bundled-DataForSEO quota per plan, in USD of underlying
 * DataForSEO cost (the same $ the cost-tracker already logs, no separate
 * "credits" unit, matching this project's transparent-pricing stance
 * elsewhere). Free gets none at all, since bundled access (not the tools
 * themselves) is the paid differentiator.
 *
 * Set at roughly 40% of the plan price (a real ~60% gross margin on the
 * bundled data), leaving room for Dodo's payment-processing cut,
 * Cloudflare Workers/D1/R2 cost, Clerk, email sends, and support time,
 * none of which the quota dollar figure by itself accounts for. This
 * replaces an earlier placeholder that set the quota equal to the plan
 * price (literally zero margin on every active subscriber); tune further
 * once real usage data exists.
 */
export const MONTHLY_QUOTA_USD: Record<Plan, number> = {
  free: 0,
  pro: 4,
  team: 20
};

/**
 * Monthly recurring subscription price per plan in USD.
 * Community/free is $0 forever. Pro is $10/mo (with $4/mo bundled usage),
 * and Team is $50/mo (with $20/mo bundled usage).
 */
export const PLAN_PRICES_USD: Record<Plan, number> = {
  free: 0,
  pro: 10,
  team: 50
};

/**
 * Multiplier applied to a call's real DataForSEO cost once a tenant is
 * past their plan's bundled quota and drawing from their prepaid wallet
 * (src/db/subscriptions.ts's wallet_balance_usd) instead of being
 * blocked. A flat convenience markup rather than the ~60% margin baked
 * into the bundled quota above: overage is a top-up purchase from an
 * already-paying customer, closer to a processing-and-margin fee (in the
 * spirit of OpenRouter's ~5% cut on a BYOK pass-through call) than a full
 * resale margin. Tune once real usage patterns exist.
 */
export const OVERAGE_MARKUP_MULTIPLIER = 1.15;

/** The smallest wallet top-up Dodo will process, in USD; below this, the card-processing fee alone eats too much of the payment to be worth it. */
export const MIN_TOPUP_USD = 5;

/** Fixed top-up amounts offered on the dashboard's "buy credits" form. Nothing stops a future custom-amount field from calling startWalletTopup with any value >= MIN_TOPUP_USD. */
export const TOPUP_PRESETS_USD = [10, 25, 100];
