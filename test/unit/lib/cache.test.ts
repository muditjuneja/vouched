import { describe, expect, it, vi } from "vitest";
import { getOrSetCache } from "../../../src/lib/cache";

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

describe("getOrSetCache", () => {
  it("calls compute and reports a miss on the first call for a key", async () => {
    const kv = fakeKv();
    const compute = vi.fn().mockResolvedValue({ hello: "world" });
    const result = await getOrSetCache(kv, "key-1", 3600, compute);
    expect(result).toEqual({ value: { hello: "world" }, cacheHit: false });
    expect(compute).toHaveBeenCalledOnce();
  });

  it("returns the cached value and reports a hit on a repeat call, without calling compute again", async () => {
    const kv = fakeKv();
    const compute = vi.fn().mockResolvedValue({ hello: "world" });
    await getOrSetCache(kv, "key-1", 3600, compute);
    const second = await getOrSetCache(kv, "key-1", 3600, compute);
    expect(second).toEqual({ value: { hello: "world" }, cacheHit: true });
    expect(compute).toHaveBeenCalledOnce();
  });

  it("treats different keys as independent entries", async () => {
    const kv = fakeKv();
    const computeA = vi.fn().mockResolvedValue("a");
    const computeB = vi.fn().mockResolvedValue("b");
    await getOrSetCache(kv, "key-a", 3600, computeA);
    const result = await getOrSetCache(kv, "key-b", 3600, computeB);
    expect(result).toEqual({ value: "b", cacheHit: false });
    expect(computeB).toHaveBeenCalledOnce();
  });

  it("clamps a sub-60s ttl up to KV's own minimum instead of letting the write silently fail", async () => {
    const kv = fakeKv();
    const put = vi.spyOn(kv, "put");
    await getOrSetCache(kv, "key-1", 5, () => Promise.resolve("x"));
    expect(put).toHaveBeenCalledWith("key-1", expect.any(String), { expirationTtl: 60 });
  });
});
