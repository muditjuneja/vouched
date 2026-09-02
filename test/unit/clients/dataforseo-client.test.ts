import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dfsLivePost } from "../../../src/clients/dataforseo/client";
import { QuotaExceededError } from "../../../src/lib/errors";
import type { Env } from "../../../src/types/env";

/**
 * A tiny in-memory fake covering just the three tables dfsLivePost's call
 * chain touches (subscriptions, usage_counters, cost_log) — enough to
 * exercise the real quota-gate logic without a real D1 binding
 * (unavailable in this sandbox — see README).
 */
function fakeDb() {
  const subscriptions = new Map<string, { plan: string; status: string }>();
  const usage = new Map<string, number>(); // tenantId -> cost_incurred_usd

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
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue(
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
});
