import type { Plan } from "../db/subscriptions";

/**
 * Monthly bundled-DataForSEO quota per plan, in USD of underlying
 * DataForSEO cost (the same $ the cost-tracker already logs — no separate
 * "credits" unit, matching this project's transparent-pricing stance
 * elsewhere). Placeholder amounts — tune against real DataForSEO cost data
 * and desired margin before launch; free gets none at all, since bundled
 * access (not the tools themselves) is the paid differentiator.
 */
export const MONTHLY_QUOTA_USD: Record<Plan, number> = {
  free: 0,
  pro: 10,
  team: 50
};
