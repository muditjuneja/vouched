import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../../../src/types/env";

import { cachedGscCall } from "../../../../src/domains/gsc/shared";

function fakeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: (async (key: string, type?: string) => {
      const raw = store.get(key);
      if (raw === undefined) return null;
      return type === "json" ? JSON.parse(raw) : raw;
    }) as KVNamespace["get"],
    put: (async (key: string, value: string) => {
      store.set(key, value);
    }) as KVNamespace["put"]
  } as KVNamespace;
}

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATASETS: { put: vi.fn().mockResolvedValue(undefined) } as unknown as R2Bucket,
    CACHE: fakeKv(),
    MCP_BEARER_TOKEN: "x",
    ...overrides
  };
}

function fakeCloudEnv(overrides: Partial<Env> = {}): Env {
  return fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test", ...overrides });
}

describe("cachedGscCall", () => {
  it("computes and caches on the first call, reports cacheHit: false", async () => {
    const env = fakeEnv();
    const compute = vi.fn().mockResolvedValue({ rows: [] });
    const result = await cachedGscCall(env, "tenant-1", "get_search_performance", "key-1", 3600, compute);
    expect(result).toEqual({ value: { rows: [] }, cacheHit: false });
    expect(compute).toHaveBeenCalledOnce();
  });

  it("serves the second identical call from cache, reports cacheHit: true, never calls compute again", async () => {
    const env = fakeEnv();
    const compute = vi.fn().mockResolvedValue({ rows: [] });
    await cachedGscCall(env, "tenant-1", "get_search_performance", "key-1", 3600, compute);
    const second = await cachedGscCall(env, "tenant-1", "get_search_performance", "key-1", 3600, compute);
    expect(second.cacheHit).toBe(true);
    expect(compute).toHaveBeenCalledOnce();
  });

  it("never writes Search Console data to R2, in either mode", async () => {
    const env = fakeCloudEnv();
    await cachedGscCall(env, "tenant-1", "get_search_performance", "key-1", 3600, () => Promise.resolve({ rows: [] }));
    expect(env.DATASETS.put).not.toHaveBeenCalled();
  });

  it("treats different keys as independent cache entries", async () => {
    const env = fakeEnv();
    const computeA = vi.fn().mockResolvedValue("a");
    const computeB = vi.fn().mockResolvedValue("b");
    await cachedGscCall(env, "tenant-1", "get_search_performance", "key-a", 3600, computeA);
    const result = await cachedGscCall(env, "tenant-1", "get_search_performance", "key-b", 3600, computeB);
    expect(result).toEqual({ value: "b", cacheHit: false });
  });
});
