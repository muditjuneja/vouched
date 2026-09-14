import { describe, expect, it } from "vitest";
import { creditWallet, debitWallet, getEffectivePlan, getWalletBalance, type SubscriptionRow } from "../../../src/db/subscriptions";

/**
 * A minimal fake D1Database: just enough of `.prepare().bind().first()`
 * to exercise getSubscription/getEffectivePlan's pure decision logic
 * without a real D1 binding (unavailable in this sandbox, see README).
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
      // 1 day after current_period_end, still inside the 3-day grace window.
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
    // 4 days after current_period_end, past the 3-day grace window.
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

/** A tiny in-memory fake of subscriptions.wallet_balance_usd + wallet_ledger, enough to exercise the real wallet CRUD logic (idempotent credit, atomic conditional debit). */
function fakeWalletDb() {
  const balances = new Map<string, number>();
  const appliedPaymentIds = new Set<string>();

  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("wallet_balance_usd") && sql.includes("FROM subscriptions")) {
                const [tenantId] = args as [string];
                const balance = balances.get(tenantId);
                return (balance === undefined ? null : { wallet_balance_usd: balance }) as T | null;
              }
              throw new Error(`unhandled first(): ${sql}`);
            },
            async run() {
              if (sql.startsWith("INSERT OR IGNORE INTO wallet_ledger")) {
                const [, , dodoPaymentId] = args as [string, number, string];
                if (appliedPaymentIds.has(dodoPaymentId)) return { success: true, meta: { changes: 0 } };
                appliedPaymentIds.add(dodoPaymentId);
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.startsWith("INSERT INTO subscriptions")) {
                const [tenantId, amountUsd] = args as [string, number];
                balances.set(tenantId, (balances.get(tenantId) ?? 0) + amountUsd);
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.startsWith("UPDATE subscriptions") && sql.includes("wallet_balance_usd = wallet_balance_usd -")) {
                const [amountUsd, tenantId] = args as [number, string];
                const balance = balances.get(tenantId) ?? 0;
                if (balance < amountUsd) return { success: true, meta: { changes: 0 } };
                balances.set(tenantId, balance - amountUsd);
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.startsWith("INSERT INTO wallet_ledger")) {
                return { success: true, meta: { changes: 1 } };
              }
              throw new Error(`unhandled run(): ${sql}`);
            }
          };
        }
      };
    }
  };

  return { db: db as unknown as D1Database, balances };
}

describe("getWalletBalance", () => {
  it("returns 0 for a tenant with no subscriptions row at all", async () => {
    const { db } = fakeWalletDb();
    expect(await getWalletBalance(db, "tenant-1")).toBe(0);
  });

  it("returns the stored balance for a tenant that has one", async () => {
    const { db, balances } = fakeWalletDb();
    balances.set("tenant-1", 12.5);
    expect(await getWalletBalance(db, "tenant-1")).toBe(12.5);
  });
});

describe("creditWallet", () => {
  it("credits a brand-new tenant (no prior subscriptions row) and returns true", async () => {
    const { db, balances } = fakeWalletDb();
    expect(await creditWallet(db, "tenant-1", 10, "pay_1")).toBe(true);
    expect(balances.get("tenant-1")).toBe(10);
  });

  it("adds to an existing balance rather than replacing it", async () => {
    const { db, balances } = fakeWalletDb();
    balances.set("tenant-1", 5);
    expect(await creditWallet(db, "tenant-1", 10, "pay_1")).toBe(true);
    expect(balances.get("tenant-1")).toBe(15);
  });

  it("is idempotent: a repeated dodo_payment_id is ignored and returns false", async () => {
    const { db, balances } = fakeWalletDb();
    await creditWallet(db, "tenant-1", 10, "pay_1");
    expect(await creditWallet(db, "tenant-1", 10, "pay_1")).toBe(false);
    expect(balances.get("tenant-1")).toBe(10); // not 20
  });

  it("a different payment_id still credits normally", async () => {
    const { db, balances } = fakeWalletDb();
    await creditWallet(db, "tenant-1", 10, "pay_1");
    await creditWallet(db, "tenant-1", 5, "pay_2");
    expect(balances.get("tenant-1")).toBe(15);
  });
});

describe("debitWallet", () => {
  it("debits when the balance is sufficient and returns true", async () => {
    const { db, balances } = fakeWalletDb();
    balances.set("tenant-1", 10);
    expect(await debitWallet(db, "tenant-1", 3, "2026-01")).toBe(true);
    expect(balances.get("tenant-1")).toBe(7);
  });

  it("leaves the balance untouched and returns false when it's insufficient", async () => {
    const { db, balances } = fakeWalletDb();
    balances.set("tenant-1", 1);
    expect(await debitWallet(db, "tenant-1", 3, "2026-01")).toBe(false);
    expect(balances.get("tenant-1")).toBe(1);
  });

  it("returns false for a tenant with no wallet at all rather than going negative", async () => {
    const { db, balances } = fakeWalletDb();
    expect(await debitWallet(db, "tenant-1", 1, "2026-01")).toBe(false);
    expect(balances.has("tenant-1")).toBe(false);
  });

  it("debits exactly the full balance down to zero", async () => {
    const { db, balances } = fakeWalletDb();
    balances.set("tenant-1", 5);
    expect(await debitWallet(db, "tenant-1", 5, "2026-01")).toBe(true);
    expect(balances.get("tenant-1")).toBe(0);
  });
});
