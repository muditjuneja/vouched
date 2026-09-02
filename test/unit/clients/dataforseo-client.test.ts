import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dfsLivePost } from "../../../src/clients/dataforseo/client";
import { QuotaExceededError } from "../../../src/lib/errors";
import type { Env } from "../../../src/types/env";

vi.mock("../../../src/email/notifications", () => ({
  notifyQuotaWarning: vi.fn()
}));
import { notifyQuotaWarning } from "../../../src/email/notifications";

/**
 * A tiny in-memory fake covering the tables dfsLivePost's call chain
 * touches (subscriptions, usage_counters, cost_log, tenant_notifications)
 * — enough to exercise the real quota-gate and quota-warning-dedup logic
 * without a real D1 binding (unavailable in this sandbox — see README).
 */
function fakeDb() {
  const subscriptions = new Map<string, { plan: string; status: string }>();
  const usage = new Map<string, number>(); // tenantId -> cost_incurred_usd
  const notified = new Set<string>(); // "tenantId:noticeKey"

  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM subscriptions")) {
                const [tenantId] = args as [string];
                const sub = subscriptions.get(tenantId);
                return (sub ? { ...sub, tenant_id: tenantId } : null) as T | null;
              }
              if (sql.includes("FROM usage_counters")) {
                const [tenantId] = args as [string, string];
                const cost = usage.get(tenantId);
                return (cost === undefined ? null : { cost_incurred_usd: cost }) as T | null;
              }
              throw new Error(`unhandled first(): ${sql}`);
            },
            async run() {
              if (sql.startsWith("INSERT INTO usage_counters")) {
                const [tenantId, , cost] = args as [string, string, number];
                usage.set(tenantId, (usage.get(tenantId) ?? 0) + cost);
              } else if (sql.startsWith("INSERT OR IGNORE INTO tenant_notifications")) {
                const [tenantId, noticeKey] = args as [string, string];
                const key = `${tenantId}:${noticeKey}`;
                if (notified.has(key)) return { success: true, meta: { changes: 0 } };
                notified.add(key);
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
    setSubscription: (tenantId: string, plan: string, status = "active") =>
      subscriptions.set(tenantId, { plan, status }),
    setUsage: (tenantId: string, costUsd: number) => usage.set(tenantId, costUsd)
  };
}

function fakeEnv(db: D1Database, overrides: Partial<Env> = {}): Env {
  return {
    DB: db,
    DATASETS: {} as R2Bucket,
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
    // Response — a Response's body can only be read once, and some tests
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

  it("blocks a free-plan tenant before ever calling DataForSEO", async () => {
    const { db } = fakeDb(); // no subscription row -> free plan
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-free" });

    await expect(dfsLivePost(env, "research_keywords", "/v3/whatever/live", {})).rejects.toThrow(
      QuotaExceededError
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows a pro-plan tenant under quota and records the usage", async () => {
    const { db, setSubscription, setUsage } = fakeDb();
    setSubscription("tenant-pro", "pro");
    setUsage("tenant-pro", 2); // well under pro's $10 quota
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-pro" });

    const result = await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(result).toEqual([{ hit: true }]);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("blocks a pro-plan tenant who has already hit their quota", async () => {
    const { db, setSubscription, setUsage } = fakeDb();
    setSubscription("tenant-pro", "pro");
    setUsage("tenant-pro", 10); // exactly at pro's $10 quota
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
    setUsage("tenant-pro", 7.9); // pro's quota is $10 — this call's $1 cost lands at 8.9 (>80%)
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-pro" });

    await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(notifyQuotaWarning).toHaveBeenCalledTimes(1);
    expect(notifyQuotaWarning).toHaveBeenCalledWith(env, "tenant-pro", 80);

    // A second call in the same period, still under 100% (usage now 9.9/10) — no repeat warning.
    await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(notifyQuotaWarning).toHaveBeenCalledTimes(1);

    // A third call pushes usage to 10.9/10 (over 100%) — fires the 100% warning once.
    await dfsLivePost(env, "research_keywords", "/v3/whatever/live", {});
    expect(notifyQuotaWarning).toHaveBeenCalledTimes(2);
    expect(notifyQuotaWarning).toHaveBeenLastCalledWith(env, "tenant-pro", 100);
  });

  it("never warns for the free plan (no bundled quota to warn about)", async () => {
    const { db } = fakeDb(); // no subscription row -> free plan, blocked before this point anyway
    const env = fakeEnv(db, { ...cloudOverrides, __tenantId: "tenant-free" });

    await expect(dfsLivePost(env, "research_keywords", "/v3/whatever/live", {})).rejects.toThrow(QuotaExceededError);
    expect(notifyQuotaWarning).not.toHaveBeenCalled();
  });
});
