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

  const factDataset = (capped: boolean) => ({
    version: 2,
    fact_type: "gsc.query_performance",
    source_class: "webmaster_console",
    method: "gsc.searchAnalytics.query",
    observed_at: "2026-09-24T22:12:27.000Z",
    capped,
    row_limit: 1000,
    entities: [{ id: "keyword:any:GLOBAL:vouched", kind: "keyword", label: "vouched" }],
    items: [{ subject: ["keyword:any:GLOBAL:vouched"], data: { dimensions: { query: "vouched" }, clicks: 3, impressions: 40, ctr: 0.075, position: 2.1 } }]
  });

  it("returns an export as the same facts the inline response uses, with the original fetch time", async () => {
    readDataset.mockResolvedValueOnce(factDataset(false));
    const result = await exportDataset.handler({ uri: "mcpseo://gsc/get_search_performance/x.json" }, fakeEnv());
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toMatchObject({
      type: "gsc.query_performance",
      data: { dimensions: { query: "vouched" }, clicks: 3 },
      provenance: { source_class: "webmaster_console", observed_at: "2026-09-24T22:12:27.000Z" }
    });
    expect(result.entities).toHaveLength(1);
    expect(result.coverage).toMatchObject({ returned: 1, total: 1, as_of: "2026-09-24T22:12:27.000Z" });
  });

  it("never claims completeness at the row cap: total is unknown and the note says so", async () => {
    readDataset.mockResolvedValueOnce(factDataset(true));
    const result = await exportDataset.handler({ uri: "mcpseo://gsc/get_search_performance/x.json" }, fakeEnv());
    expect(result.coverage.total).toBeNull();
    expect(result.coverage.scope_note).toContain("1000-row export limit");
  });

  it("still reads an older raw-rows export, counting rows but not claiming it's complete", async () => {
    readDataset.mockResolvedValueOnce(new Array(1000).fill({ clicks: 1 }));
    const result = await exportDataset.handler({ uri: "mcpseo://gsc/get_search_performance/x.json" }, fakeEnv());
    expect(result.coverage).toMatchObject({ returned: 1000, total: null });
    expect(result.coverage.scope_note).not.toContain("untruncated");
  });
});
