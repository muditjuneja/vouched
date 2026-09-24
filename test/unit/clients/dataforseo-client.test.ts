import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dfsLivePost } from "../../../src/clients/dataforseo/client";
import { QuotaExceededError, UpgradeRequiredError } from "../../../src/lib/errors";
import type { Env } from "../../../src/types/env";

vi.mock("../../../src/email/notifications", () => ({
  notifyQuotaWarning: vi.fn(),
  notifyLowWalletBalance: vi.fn()
}));
import { notifyLowWalletBalance, notifyQuotaWarning } from "../../../src/email/notifications";

/**
 * A tiny in-memory fake covering the tables dfsLivePost's call chain
 * touches (subscriptions, including its wallet_balance_usd column and
 * the wallet_ledger audit trail, usage_counters, cost_log,
 * tenant_notifications), enough to exercise the real quota gate,
 * overage-wallet gate, and both notification-dedup shapes without a real
 * D1 binding (unavailable in this sandbox, see README).
 */
function fakeDb() {
  const subscriptions = new Map<string, { plan: string; status: string; wallet_balance_usd: number }>();
  const usage = new Map<string, number>(); // tenantId -> cost_incurred_usd
  const notifiedOnce = new Set<string>(); // "tenantId:noticeKey"
  const notifiedCooldown = new Map<string, string>(); // "tenantId:noticeKey" -> sent_at ISO

  function sub(tenantId: string) {
    return subscriptions.get(tenantId);
  }

  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("wallet_balance_usd") && sql.includes("FROM subscriptions")) {
                const [tenantId] = args as [string];
                const row = sub(tenantId);
                return (row ? { wallet_balance_usd: row.wallet_balance_usd } : null) as T | null;
              }
              if (sql.includes("FROM subscriptions")) {
                const [tenantId] = args as [string];
                const row = sub(tenantId);
                return (row ? { ...row, tenant_id: tenantId } : null) as T | null;
              }
              if (sql.includes("FROM usage_counters")) {
                const [tenantId] = args as [string, string];
                const cost = usage.get(tenantId);
                return (cost === undefined ? null : { cost_incurred_usd: cost }) as T | null;
              }
              if (sql.includes("FROM tenant_notifications")) {
                const [tenantId, noticeKey] = args as [string, string];
                const sentAt = notifiedCooldown.get(`${tenantId}:${noticeKey}`);
                return (sentAt === undefined ? null : { sent_at: sentAt }) as T | null;
              }
              throw new Error(`unhandled first(): ${sql}`);
            },
            async run() {
              if (sql.startsWith("INSERT INTO usage_counters")) {
                const [tenantId, , cost] = args as [string, string, number];
                usage.set(tenantId, (usage.get(tenantId) ?? 0) + cost);
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.startsWith("INSERT OR IGNORE INTO tenant_notifications")) {
                const [tenantId, noticeKey] = args as [string, string];
                const key = `${tenantId}:${noticeKey}`;
                if (notifiedOnce.has(key)) return { success: true, meta: { changes: 0 } };
                notifiedOnce.add(key);
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.startsWith("INSERT INTO tenant_notifications") && sql.includes("ON CONFLICT")) {
                const [tenantId, noticeKey, sentAt] = args as [string, string, string];
                notifiedCooldown.set(`${tenantId}:${noticeKey}`, sentAt);
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.startsWith("UPDATE subscriptions") && sql.includes("wallet_balance_usd = wallet_balance_usd -")) {
                const [amountUsd, tenantId] = args as [number, string];
                const row = sub(tenantId);
                if (!row || row.wallet_balance_usd < amountUsd) return { success: true, meta: { changes: 0 } };
                row.wallet_balance_usd -= amountUsd;
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.startsWith("INSERT INTO wallet_ledger")) {
                return { success: true, meta: { changes: 1 } };
              }
              // cost_log INSERT: nothing to track for these tests.
              return { success: true, meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };

  return {
    db: db as unknown as D1Database,
    setSubscription: (tenantId: string, plan: string, status = "active", walletBalanceUsd = 0) =>
      subscriptions.set(tenantId, { plan, status, wallet_balance_usd: walletBalanceUsd }),
    setWalletBalance: (tenantId: string, amountUsd: number) => {
      const existing = sub(tenantId);
      subscriptions.set(tenantId, existing ? { ...existing, wallet_balance_usd: amountUsd } : { plan: "free", status: "pending", wallet_balance_usd: amountUsd });
    },
    setUsage: (tenantId: string, costUsd: number) => usage.set(tenantId, costUsd),
    walletBalance: (tenantId: string) => sub(tenantId)?.wallet_balance_usd ?? 0
  };
}

function fakeEnv(db: D1Database, overrides: Partial<Env> = {}): Env {
  return {
    DB: db,
    DATASETS: {} as R2Bucket,
    CACHE: {} as KVNamespace,
    MCP_BEARER_TOKEN: "x",
    ...overrides
  };
}

const cloudOverrides = {
  CLOUD_MODE: "1",
  CLERK_SECRET_KEY: "sk_test",
  CLOUD_DATAFORSEO_LOGIN: "cloud-login",
  CLOUD_DATAFORSEO_PASSWORD: "cloud-password"
};

describe("dfsLivePost quota enforcement (cloud mode, bundled access)", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy.mockReset();
    // mockImplementation (not mockResolvedValue) so each call gets a fresh
    // Response: a Response's body can only be read once, and some tests
    // below call dfsLivePost more than once against the same mock.
    fetchSpy.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          status_code: 20000,
          status_message: "ok",
          cost: 1,
          tasks: [{ id: "1", status_code: 20000, status_message: "ok", cost: 1, result: [{ hit: true }] }]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tells a free-plan tenant to upgrade, before ever calling DataForSEO", async () => {
    const { db } = fakeDb(); // no subscription row -> free plan, no wallet
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-free" });

    await expect(dfsLivePost(env, "research_keywords", "/v3/whatever/live", {})).rejects.toThrow(
      UpgradeRequiredError
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows a pro-plan tenant under quota and records the usage", async () => {
    const { db, setSubscription, setUsage } = fakeDb();
    setSubscription("tenant-pro", "pro");
    setUsage("tenant-pro", 1); // well under pro's $4 quota
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-pro" });

    const result = await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(result).toEqual([{ hit: true }]);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("blocks a pro-plan tenant who has already hit their quota and has no wallet balance", async () => {
    const { db, setSubscription, setUsage } = fakeDb();
    setSubscription("tenant-pro", "pro");
    setUsage("tenant-pro", 4); // exactly at pro's $4 quota
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-pro" });

    await expect(dfsLivePost(env, "research_keywords", "/v3/whatever/live", {})).rejects.toThrow(
      QuotaExceededError
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("self-host (not cloud mode) bypasses the quota gate entirely", async () => {
    const { db } = fakeDb();
    const env = fakeEnv(db, { DATAFORSEO_LOGIN: "self-host-login", DATAFORSEO_PASSWORD: "self-host-pw" });

    const result = await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(result).toEqual([{ hit: true }]);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("warns at 80% of quota and again at 100%, each exactly once per period", async () => {
    const { db, setSubscription, setUsage } = fakeDb();
    setSubscription("tenant-pro", "pro");
    setUsage("tenant-pro", 2.9); // pro's quota is $4; a $0.5 call lands at 3.4 (85%)
    fetchSpy.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          status_code: 20000,
          status_message: "ok",
          cost: 0.5,
          tasks: [{ id: "1", status_code: 20000, status_message: "ok", cost: 0.5, result: [{ hit: true }] }]
        }),
        { status: 200 }
      )
    );
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-pro" });

    await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(notifyQuotaWarning).toHaveBeenCalledTimes(1);
    expect(notifyQuotaWarning).toHaveBeenCalledWith(env, "tenant-pro", 80);

    // A second call, still under 100% (usage now 3.9/4): no repeat warning.
    await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(notifyQuotaWarning).toHaveBeenCalledTimes(1);

    // A third call pushes usage to 4.4/4 (over 100%): fires the 100% warning once.
    await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(notifyQuotaWarning).toHaveBeenCalledTimes(2);
    expect(notifyQuotaWarning).toHaveBeenLastCalledWith(env, "tenant-pro", 100);
  });

  it("never warns for the free plan (no bundled quota to warn about)", async () => {
    const { db } = fakeDb(); // no subscription row -> free plan, blocked before this point anyway
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-free" });

    await expect(dfsLivePost(env, "research_keywords", "/v3/whatever/live", {})).rejects.toThrow(UpgradeRequiredError);
    expect(notifyQuotaWarning).not.toHaveBeenCalled();
  });
});

describe("dfsLivePost overage wallet", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          status_code: 20000,
          status_message: "ok",
          cost: 1,
          tasks: [{ id: "1", status_code: 20000, status_message: "ok", cost: 1, result: [{ hit: true }] }]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lets an over-quota pro tenant through when their wallet has balance, and debits cost plus the overage markup", async () => {
    const { db, setSubscription, setUsage, walletBalance } = fakeDb();
    setSubscription("tenant-pro", "pro", "active", 5); // $5 in the wallet
    setUsage("tenant-pro", 4); // already at pro's $4 quota
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-pro" });

    const result = await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(result).toEqual([{ hit: true }]);
    expect(fetchSpy).toHaveBeenCalledOnce();
    // this call's real cost is $1, debited at $1 * OVERAGE_MARKUP_MULTIPLIER (1.15) = $1.15
    expect(walletBalance("tenant-pro")).toBeCloseTo(5 - 1.15, 5);
  });

  it("never lets a free-plan tenant spend wallet balance on paid data (e.g. left over after downgrading)", async () => {
    const { db, setWalletBalance, walletBalance } = fakeDb();
    setWalletBalance("tenant-wallet-only", 10);
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-wallet-only" });

    await expect(dfsLivePost(env, "research_keywords", "/v3/whatever/live", {})).rejects.toThrow(UpgradeRequiredError);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(walletBalance("tenant-wallet-only")).toBe(10);
  });

  it("blocks once both the quota and the wallet are exhausted", async () => {
    const { db, setSubscription, setUsage } = fakeDb();
    setSubscription("tenant-pro", "pro", "active", 0);
    setUsage("tenant-pro", 4);
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-pro" });

    await expect(dfsLivePost(env, "research_keywords", "/v3/whatever/live", {})).rejects.toThrow(QuotaExceededError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("warns once the wallet balance drops under the low-balance threshold, debounced by cooldown", async () => {
    const { db, setSubscription, setUsage } = fakeDb();
    setSubscription("tenant-pro", "pro", "active", 2.5); // just above the $2 low-balance threshold
    setUsage("tenant-pro", 4);
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-pro" });

    // $1 * 1.15 = $1.15 debited -> balance 1.35, under the $2 threshold.
    await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(notifyLowWalletBalance).toHaveBeenCalledTimes(1);
    expect(notifyLowWalletBalance).toHaveBeenCalledWith(env, "tenant-pro", expect.closeTo(1.35, 5));

    // A second overage call still under the threshold: cooldown suppresses a repeat.
    await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(notifyLowWalletBalance).toHaveBeenCalledTimes(1);
  });

  it("never fires the low-balance warning while comfortably above the threshold", async () => {
    const { db, setSubscription, setUsage } = fakeDb();
    setSubscription("tenant-pro", "pro", "active", 50);
    setUsage("tenant-pro", 4);
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-pro" });

    await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(notifyLowWalletBalance).not.toHaveBeenCalled();
  });
});
