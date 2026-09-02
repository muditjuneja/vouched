import { describe, expect, it } from "vitest";
import { getEffectivePlan, type SubscriptionRow } from "../../../src/db/subscriptions";

/**
 * A minimal fake D1Database — just enough of `.prepare().bind().first()`
 * to exercise getSubscription/getEffectivePlan's pure decision logic
 * without a real D1 binding (unavailable in this sandbox — see README).
 */
function fakeDb(row: SubscriptionRow | null): D1Database {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => row
      })
    })
  } as unknown as D1Database;
}

describe("getEffectivePlan", () => {
  it("treats a missing subscription row as the free plan", async () => {
    expect(await getEffectivePlan(fakeDb(null), "tenant-1")).toBe("free");
  });

  it("treats a non-active status as the free plan, even on a paid plan", async () => {
    const row: SubscriptionRow = {
      tenant_id: "tenant-1",
      dodo_customer_id: "cus_1",
      dodo_subscription_id: "sub_1",
      plan: "pro",
      status: "on_hold",
      current_period_end: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z"
    };
    expect(await getEffectivePlan(fakeDb(row), "tenant-1")).toBe("free");
  });

  it("returns the real plan when the subscription is active", async () => {
    const row: SubscriptionRow = {
      tenant_id: "tenant-1",
      dodo_customer_id: "cus_1",
      dodo_subscription_id: "sub_1",
      plan: "team",
      status: "active",
      current_period_end: "2026-10-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z"
    };
    expect(await getEffectivePlan(fakeDb(row), "tenant-1")).toBe("team");
  });
});
