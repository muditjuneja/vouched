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

  it("treats a deliberate/terminal status (paused/cancelled/expired/pending) as the free plan immediately", async () => {
    for (const status of ["pending", "paused", "cancelled", "expired"] as const) {
      const row: SubscriptionRow = {
        tenant_id: "tenant-1",
        dodo_customer_id: "cus_1",
        dodo_subscription_id: "sub_1",
        plan: "pro",
        status,
        current_period_end: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z"
      };
      expect(await getEffectivePlan(fakeDb(row), "tenant-1", new Date("2026-01-01T00:00:01Z"))).toBe("free");
    }
  });

  it("keeps the real plan during the grace window after a payment failure (on_hold/failed)", async () => {
    for (const status of ["on_hold", "failed"] as const) {
      const row: SubscriptionRow = {
        tenant_id: "tenant-1",
        dodo_customer_id: "cus_1",
        dodo_subscription_id: "sub_1",
        plan: "pro",
        status,
        current_period_end: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z"
      };
      // 1 day after current_period_end — still inside the 3-day grace window.
      const withinGrace = new Date("2026-01-02T00:00:00Z");
      expect(await getEffectivePlan(fakeDb(row), "tenant-1", withinGrace)).toBe("pro");
    }
  });

  it("falls back to free once the grace window after a payment failure has elapsed", async () => {
    const row: SubscriptionRow = {
      tenant_id: "tenant-1",
      dodo_customer_id: "cus_1",
      dodo_subscription_id: "sub_1",
      plan: "pro",
      status: "failed",
      current_period_end: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z"
    };
    // 4 days after current_period_end — past the 3-day grace window.
    const pastGrace = new Date("2026-01-05T00:00:00Z");
    expect(await getEffectivePlan(fakeDb(row), "tenant-1", pastGrace)).toBe("free");
  });

  it("falls back to free immediately for a payment-failure status with no current_period_end to grace against", async () => {
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
