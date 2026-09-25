import { MONTHLY_QUOTA_USD } from "./quotas";

/**
 * What each market-data tool typically costs per call, at cost, measured
 * from real production calls (cost_log, 24-25 September 2026). Shown on the
 * pricing page, each tool's page, and in describe_capabilities, so people
 * and agents can see what a call spends before making it. Nothing here
 * limits usage: these are estimates for planning.
 *
 * Costs vary a little with how many rows come back. Tools that compare
 * against several domains cost `usd` per domain.
 */
export interface ToolCostEstimate {
  usd: number;
  /** Set when the cost scales with the input, e.g. "per competitor". */
  per?: string;
}

export const TOOL_COST_ESTIMATES: Record<string, ToolCostEstimate> = {
  inspect_serp: { usd: 0.002 },
  discover_competitors: { usd: 0.013 },
  research_keywords: { usd: 0.013, per: "seed keyword" },
  inspect_page: { usd: 0.013 },
  inspect_search_visibility: { usd: 0.012 },
  inspect_keyword: { usd: 0.016 },
  inspect_backlinks: { usd: 0.024 },
  compare_keyword_coverage: { usd: 0.024, per: "competitor" },
  compare_backlink_gap: { usd: 0.028, per: "competitor" },
  inspect_domain: { usd: 0.038 },
  inspect_ai_visibility: { usd: 0.1, per: "domain compared" },
  discover_ai_citations: { usd: 0.12 }
};

/** "about $0.024 per competitor" */
export function describeCost(estimate: ToolCostEstimate): string {
  const amount = estimate.usd < 0.01 ? estimate.usd.toFixed(3) : estimate.usd.toFixed(estimate.usd < 0.1 ? 3 : 2);
  return `about $${amount}${estimate.per ? ` per ${estimate.per}` : " per call"}`;
}

/** What one unit of a tool's cost is, for "Pro covers roughly N ___". */
export function costUnit(estimate: ToolCostEstimate): string {
  if (estimate.per === "competitor") return "calls with one competitor";
  if (estimate.per === "domain compared") return "domains compared";
  if (estimate.per === "seed keyword") return "seed keywords";
  return "calls";
}

/** Roughly how many units Pro's included amount covers, e.g. 333 for a $0.012 call. */
export function callsIncludedInPro(estimate: ToolCostEstimate): number {
  return Math.floor(MONTHLY_QUOTA_USD.pro / estimate.usd);
}
