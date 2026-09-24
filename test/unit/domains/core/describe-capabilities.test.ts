import { describe, expect, it } from "vitest";
import { describeCapabilities } from "../../../../src/domains/core/describe-capabilities";
import type { Env } from "../../../../src/types/env";

describe("describe_capabilities", () => {
  const env = { DB: {} as D1Database, DATASETS: {} as R2Bucket, CACHE: {} as KVNamespace, MCP_BEARER_TOKEN: "x" } as Env;

  it("labels billing as free or paid, and never names the data supplier anywhere", async () => {
    const result = await describeCapabilities.handler({}, env);
    const tools = (result.data as { tools: Array<{ name: string; billing: string }> }).tools;
    expect(new Set(tools.map((t) => t.billing))).toEqual(new Set(["free", "paid"]));
    expect(tools.find((t) => t.name === "inspect_serp")?.billing).toBe("paid");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("dataforseo");
  });

  it("tells an agent what each paid tool typically costs, and that free tools cost nothing", async () => {
    const result = await describeCapabilities.handler({}, env);
    const tools = (result.data as { tools: Array<{ name: string; typical_cost_usd: unknown }> }).tools;
    expect(tools.find((t) => t.name === "inspect_ai_visibility")?.typical_cost_usd).toEqual({ usd: 0.1, per: "domain compared" });
    expect(tools.find((t) => t.name === "get_search_performance")?.typical_cost_usd).toBeNull();
  });
});
