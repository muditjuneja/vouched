import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../../../src/types/env";

import { cachedGscCall, urlInProperty } from "../../../../src/domains/gsc/shared";

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
    expect(result).toMatchObject({ value: { rows: [] }, cacheHit: false });
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
    expect(result).toMatchObject({ value: "b", cacheHit: false });
  });

  it("reports when the data was really fetched: a cache hit keeps the original time instead of looking fresh", async () => {
    vi.useFakeTimers();
    try {
      const env = fakeEnv();
      vi.setSystemTime(new Date("2026-09-24T22:12:27Z"));
      const first = await cachedGscCall(env, "tenant-1", "get_search_performance", "key-1", 3600, async () => ({ rows: [] }));
      vi.setSystemTime(new Date("2026-09-24T22:40:00Z"));
      const hit = await cachedGscCall(env, "tenant-1", "get_search_performance", "key-1", 3600, async () => ({ rows: [] }));
      expect(hit.cacheHit).toBe(true);
      expect(hit.fetchedAt.toISOString()).toBe("2026-09-24T22:12:27.000Z");
      expect(first.fetchedAt.toISOString()).toBe(hit.fetchedAt.toISOString());
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("urlInProperty", () => {
  it("matches a domain property's host and subdomains on either scheme, and nothing else", () => {
    expect(urlInProperty("https://example.com/a", "sc-domain:example.com")).toBe(true);
    expect(urlInProperty("http://blog.example.com/a", "sc-domain:example.com")).toBe(true);
    expect(urlInProperty("https://notexample.com/a", "sc-domain:example.com")).toBe(false);
    expect(urlInProperty("https://example.com.evil.io/a", "sc-domain:example.com")).toBe(false);
  });

  it("matches a URL-prefix property only under its exact prefix", () => {
    expect(urlInProperty("https://example.com/blog/post", "https://example.com/blog/")).toBe(true);
    expect(urlInProperty("http://example.com/blog/post", "https://example.com/blog/")).toBe(false);
    expect(urlInProperty("https://example.com/shop", "https://example.com/blog/")).toBe(false);
  });
});
