import { describe, expect, it } from "vitest";
import { planFromProductId, tenantIdFromMetadata } from "../../../src/billing/webhook-handlers";
import type { Env } from "../../../src/types/env";

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATASETS: {} as R2Bucket,
    MCP_BEARER_TOKEN: "x",
    DODO_PRODUCT_ID_PRO: "prod_pro_123",
    DODO_PRODUCT_ID_TEAM: "prod_team_456",
    ...overrides
  };
}

describe("tenantIdFromMetadata", () => {
  it("extracts a string tenant_id", () => {
    expect(tenantIdFromMetadata({ tenant_id: "user_abc" })).toBe("user_abc");
  });

  it("returns null when metadata is missing entirely", () => {
    expect(tenantIdFromMetadata(undefined)).toBeNull();
  });

  it("returns null when tenant_id is absent or not a string", () => {
    expect(tenantIdFromMetadata({})).toBeNull();
    expect(tenantIdFromMetadata({ tenant_id: 12345 })).toBeNull();
  });
});

describe("planFromProductId", () => {
  it("maps the configured Pro/Team product ids to their plans", () => {
    const env = fakeEnv();
    expect(planFromProductId(env, "prod_pro_123")).toBe("pro");
    expect(planFromProductId(env, "prod_team_456")).toBe("team");
  });

  it("defaults an unrecognized product id to free rather than guessing", () => {
    expect(planFromProductId(fakeEnv(), "prod_someone_elses_product")).toBe("free");
  });
});
