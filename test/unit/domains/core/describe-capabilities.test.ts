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
});
