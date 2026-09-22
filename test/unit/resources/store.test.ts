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
  it("round-trips whatever storeDataset just wrote", async () => {
    const objects = new Map<string, unknown>();
    const bucket = {
      put: vi.fn(async (key: string, body: string) => {
        objects.set(key, JSON.parse(body));
      }),
      get: vi.fn(async (key: string) => {
        const value = objects.get(key);
        return value === undefined ? null : { json: async () => value };
      })
    } as unknown as R2Bucket;

    const uri = await storeDataset(bucket, "gsc", "get_search_performance", { rows: [1, 2, 3] });
    expect(await readDataset(bucket, uri)).toEqual({ rows: [1, 2, 3] });
  });

  it("throws when the uri isn't a mcpseo:// uri", async () => {
    await expect(readDataset({} as R2Bucket, "https://example.com")).rejects.toThrow("not a mcpseo:// resource uri");
  });

  it("throws a 404-flavored error when the object doesn't exist (expired or never written)", async () => {
    const bucket = { get: vi.fn().mockResolvedValue(null) } as unknown as R2Bucket;
    await expect(readDataset(bucket, "mcpseo://gsc/get_search_performance/missing.json")).rejects.toThrow("dataset not found or expired");
  });
});
