import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../../src/types/env";

const { readDataset } = vi.hoisted(() => ({ readDataset: vi.fn() }));
vi.mock("../../../../src/resources/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/resources/store")>();
  return { ...actual, readDataset };
});

import { exportDataset } from "../../../../src/domains/core/export-dataset";

function fakeEnv(): Env {
  return { DB: {} as D1Database, DATASETS: {} as R2Bucket, CACHE: {} as KVNamespace, MCP_BEARER_TOKEN: "x" };
}

describe("export_dataset", () => {
  beforeEach(() => {
    readDataset.mockReset();
  });

  it("reports coverage as the actual row count, not a flat 1, when the dataset is an array", async () => {
    readDataset.mockResolvedValueOnce(new Array(1000).fill({ clicks: 1 }));
    const result = await exportDataset.handler({ uri: "mcpseo://gsc/get_search_performance/x.json" }, fakeEnv());
    expect(result.coverage).toMatchObject({ returned: 1000, total: 1000 });
  });

  it("falls back to 1 for a non-array dataset", async () => {
    readDataset.mockResolvedValueOnce({ some: "object" });
    const result = await exportDataset.handler({ uri: "mcpseo://gsc/get_search_performance/x.json" }, fakeEnv());
    expect(result.coverage).toMatchObject({ returned: 1, total: 1 });
  });

  it("reports 0 for an empty array, not 1", async () => {
    readDataset.mockResolvedValueOnce([]);
    const result = await exportDataset.handler({ uri: "mcpseo://gsc/get_search_performance/x.json" }, fakeEnv());
    expect(result.coverage).toMatchObject({ returned: 0, total: 0 });
  });
});
