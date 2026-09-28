import { describe, expect, it, vi } from "vitest";
import { readDataset, storeDataset } from "../../../src/resources/store";

describe("storeDataset", () => {
  it("writes JSON under <domain>/<tool>/<uuid>.json and returns a mcpseo:// uri pointing at it", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const bucket = { put } as unknown as R2Bucket;

    const uri = await storeDataset(bucket, "gsc", "get_search_performance", [{ a: 1 }]);

    expect(uri).toMatch(/^mcpseo:\/\/gsc\/get_search_performance\/[\w-]+\.json$/);
    const [key, body, opts] = put.mock.calls[0]!;
    expect(uri).toBe(`mcpseo://${key}`);
    expect(JSON.parse(body as string)).toEqual([{ a: 1 }]);
    expect(opts).toEqual({ httpMetadata: { contentType: "application/json" } });
  });
});

describe("readDataset", () => {
  /** In-memory R2 that keeps each object's customMetadata, like the real one. */
  function memoryBucket(): R2Bucket {
    const objects = new Map<string, { value: unknown; customMetadata?: Record<string, string> }>();
    return {
      put: vi.fn(async (key: string, body: string, opts?: R2PutOptions) => {
        objects.set(key, { value: JSON.parse(body), customMetadata: opts?.customMetadata as Record<string, string> | undefined });
      }),
      get: vi.fn(async (key: string) => {
        const stored = objects.get(key);
        return stored === undefined ? null : { uploaded: new Date(), customMetadata: stored.customMetadata, json: async () => stored.value };
      })
    } as unknown as R2Bucket;
  }

  it("round-trips whatever storeDataset just wrote", async () => {
    const bucket = memoryBucket();
    const uri = await storeDataset(bucket, "gsc", "get_search_performance", { rows: [1, 2, 3] });
    expect(await readDataset(bucket, uri)).toEqual({ rows: [1, 2, 3] });
  });

  it("gives a tenant's export back to that tenant only (cloud mode)", async () => {
    const bucket = memoryBucket();
    const uri = await storeDataset(bucket, "gsc", "get_search_performance", { rows: [1] }, "tenant_a");
    expect(await readDataset(bucket, uri, "tenant_a")).toEqual({ rows: [1] });
    await expect(readDataset(bucket, uri, "tenant_b")).rejects.toThrow("dataset not found or expired");
  });

  it("doesn't hand an untagged export to a cloud tenant", async () => {
    const bucket = memoryBucket();
    const uri = await storeDataset(bucket, "gsc", "get_search_performance", { rows: [1] });
    await expect(readDataset(bucket, uri, "tenant_a")).rejects.toThrow("dataset not found or expired");
  });

  it("refuses an export older than 7 days, even if the lifecycle rule hasn't deleted it yet", async () => {
    const uploaded = new Date("2026-09-01T00:00:00Z");
    const bucket = { get: vi.fn().mockResolvedValue({ uploaded, json: async () => ({ rows: [] }) }) } as unknown as R2Bucket;
    const uri = "mcpseo://gsc/get_search_performance/old.json";
    expect(await readDataset(bucket, uri, null, new Date("2026-09-07T23:00:00Z"))).toEqual({ rows: [] });
    await expect(readDataset(bucket, uri, null, new Date("2026-09-08T01:00:00Z"))).rejects.toThrow("dataset not found or expired");
  });

  it("throws when the uri isn't a mcpseo:// uri", async () => {
    await expect(readDataset({} as R2Bucket, "https://example.com")).rejects.toThrow("not a mcpseo:// resource uri");
  });

  it("throws a 404-flavored error when the object doesn't exist (expired or never written)", async () => {
    const bucket = { get: vi.fn().mockResolvedValue(null) } as unknown as R2Bucket;
    await expect(readDataset(bucket, "mcpseo://gsc/get_search_performance/missing.json")).rejects.toThrow("dataset not found or expired");
  });
});
