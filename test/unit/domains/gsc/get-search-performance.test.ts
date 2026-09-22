import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionRequiredError } from "../../../../src/lib/errors";
import type { Env } from "../../../../src/types/env";

// getSearchPerformance touches D1 (getWebsiteByDomain), a real OAuth token
// refresh (getValidAccessToken), and Google's live searchAnalytics.query
// endpoint (querySearchAnalytics), none of which are available in this
// sandbox (see README's @cloudflare/vitest-pool-workers note). All three
// are mocked here so the handler's own logic (dimension/entity mapping,
// filter building, rowLimit truncation, period-over-period deltas) is
// exercised directly, same pattern as test/unit/dashboard/routes.test.ts.
const { getWebsiteByDomain } = vi.hoisted(() => ({ getWebsiteByDomain: vi.fn() }));
vi.mock("../../../../src/db/websites", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/db/websites")>();
  return { ...actual, getWebsiteByDomain };
});

const { getValidAccessToken } = vi.hoisted(() => ({ getValidAccessToken: vi.fn() }));
vi.mock("../../../../src/auth/google-oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/auth/google-oauth")>();
  return { ...actual, getValidAccessToken };
});

const { querySearchAnalytics } = vi.hoisted(() => ({ querySearchAnalytics: vi.fn() }));
vi.mock("../../../../src/clients/google/search-console", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/clients/google/search-console")>();
  return { ...actual, querySearchAnalytics };
});


import { getSearchPerformance } from "../../../../src/domains/gsc/get-search-performance";

/** In-memory stand-in for the CACHE KV binding: just enough of .get/.put for getOrSetCache. */
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

/** In-memory stand-in for the DATASETS R2 binding: just enough of .put for storeDataset. */
function fakeR2(): R2Bucket {
  return { put: async () => undefined } as unknown as R2Bucket;
}

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return { DB: {} as D1Database, DATASETS: fakeR2(), CACHE: fakeKv(), MCP_BEARER_TOKEN: "x", ...overrides };
}

const WEBSITE = {
  website_id: "w1",
  name: "Example",
  primary_domain: "example.com",
  is_default: 0,
  gsc_site_url: "sc-domain:example.com",
  ga4_property_id: null,
  tenant_id: null,
  created_at: "2026-01-01"
};

describe("get_search_performance", () => {
  beforeEach(() => {
    getWebsiteByDomain.mockReset();
    getValidAccessToken.mockReset();
    querySearchAnalytics.mockReset();
  });

  it("throws ConnectionRequiredError when the website has no gsc_site_url configured", async () => {
    getWebsiteByDomain.mockResolvedValueOnce({ ...WEBSITE, gsc_site_url: null });
    await expect(
      getSearchPerformance.handler({ domain: "example.com", startDate: "2026-01-01", endDate: "2026-01-31" }, fakeEnv())
    ).rejects.toThrow(ConnectionRequiredError);
  });

  it("defaults to a single-dimension query breakdown and produces one keyword entity per row", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    // Same response for both the detail call and the totals-only call
    // (dimensions: []) fetchTotals makes right after it; only the detail
    // call's rows are asserted on here.
    querySearchAnalytics.mockResolvedValue({
      rows: [{ keys: ["resend alternatives"], clicks: 10, impressions: 100, ctr: 0.1, position: 5 }]
    });

    const result = await getSearchPerformance.handler({ domain: "example.com", startDate: "2026-01-01", endDate: "2026-01-31" }, fakeEnv());

    expect(querySearchAnalytics).toHaveBeenCalledWith(
      "token-123",
      "sc-domain:example.com",
      expect.objectContaining({ dimensions: ["query"], rowLimit: 25 })
    );
    expect(result.entities).toContainEqual(expect.objectContaining({ kind: "keyword", label: "resend alternatives" }));
    const rowFact = result.facts.find((f) => f.type === "gsc.query_performance");
    expect(rowFact?.data).toMatchObject({ dimensions: { query: "resend alternatives" }, clicks: 10 });
  });

  it("cross-tabs multiple dimensions and adds both a keyword and a page entity when both are present", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    querySearchAnalytics.mockResolvedValue({
      rows: [{ keys: ["resend alternatives", "https://example.com/blog"], clicks: 3, impressions: 30, ctr: 0.1, position: 4 }]
    });

    const result = await getSearchPerformance.handler(
      { domain: "example.com", startDate: "2026-01-01", endDate: "2026-01-31", dimensions: ["query", "page"] },
      fakeEnv()
    );

    expect(result.entities).toContainEqual(expect.objectContaining({ kind: "keyword" }));
    expect(result.entities).toContainEqual(expect.objectContaining({ kind: "page", label: "https://example.com/blog" }));
    const rowFact = result.facts.find((f) => f.type === "gsc.query_performance");
    expect(rowFact?.subject).toHaveLength(2);
  });

  it("computes gsc.performance_summary from a dedicated totals-only query (dimensions: []), not by summing the rowLimit-truncated detail rows", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    // Detail rows are capped at rowLimit: 1 (a single row, 10 clicks), but
    // the property's real total for the period is far higher (31 clicks):
    // exactly the shape of the bug this test guards against.
    querySearchAnalytics.mockImplementation(async (_token, _siteUrl, query) => {
      if (query.dimensions.length === 0) {
        return { rows: [{ keys: [], clicks: 31, impressions: 20368, ctr: 0.0015, position: 11.2 }] };
      }
      return { rows: [{ keys: ["resend alternatives"], clicks: 10, impressions: 100, ctr: 0.1, position: 5 }] };
    });

    const result = await getSearchPerformance.handler(
      { domain: "example.com", startDate: "2026-01-01", endDate: "2026-01-31", rowLimit: 1 },
      fakeEnv()
    );

    const summaryFact = result.facts.find((f) => f.type === "gsc.performance_summary");
    expect(summaryFact?.data).toMatchObject({ clicks: 31, impressions: 20368 });
    expect(querySearchAnalytics).toHaveBeenCalledWith("token-123", "sc-domain:example.com", expect.objectContaining({ dimensions: [], rowLimit: 1 }));
  });

  it("builds a device/query/page dimensionFilterGroups filter set from the convenience args", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    querySearchAnalytics.mockResolvedValue({ rows: [] });

    await getSearchPerformance.handler(
      {
        domain: "example.com",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        device: "MOBILE",
        country: "USA",
        queryContains: "alternatives",
        pageContains: "/blog"
      },
      fakeEnv()
    );

    expect(querySearchAnalytics).toHaveBeenCalledWith(
      "token-123",
      "sc-domain:example.com",
      expect.objectContaining({
        filters: [
          { dimension: "device", operator: "equals", expression: "MOBILE" },
          { dimension: "country", operator: "equals", expression: "usa" },
          { dimension: "query", operator: "contains", expression: "alternatives" },
          { dimension: "page", operator: "contains", expression: "/blog" }
        ]
      })
    );
  });

  it("appends the searchAppearance convenience filter and any customFilters, in that order", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    querySearchAnalytics.mockResolvedValue({ rows: [] });

    await getSearchPerformance.handler(
      {
        domain: "example.com",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        searchAppearance: "RICHCARD",
        customFilters: [{ dimension: "query", operator: "excludingRegex", expression: "^free" }]
      },
      fakeEnv()
    );

    expect(querySearchAnalytics).toHaveBeenCalledWith(
      "token-123",
      "sc-domain:example.com",
      expect.objectContaining({
        filters: [
          { dimension: "searchAppearance", operator: "equals", expression: "RICHCARD" },
          { dimension: "query", operator: "excludingRegex", expression: "^free" }
        ]
      })
    );
  });

  it("passes searchType/dataState/aggregationType/startRow straight through to every query, and surfaces response metadata", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    // The detail call's own response carries the metadata that ends up in
    // result.data; the totals call right after it just needs to not crash.
    querySearchAnalytics
      .mockResolvedValueOnce({ rows: [], responseAggregationType: "byPage", metadata: { firstIncompleteDate: "2026-01-31" } })
      .mockResolvedValue({ rows: [] });

    const result = await getSearchPerformance.handler(
      {
        domain: "example.com",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        searchType: "discover",
        dataState: "all",
        aggregationType: "byPage",
        startRow: 50
      },
      fakeEnv()
    );

    expect(querySearchAnalytics).toHaveBeenCalledWith(
      "token-123",
      "sc-domain:example.com",
      expect.objectContaining({ searchType: "discover", dataState: "all", aggregationType: "byPage", startRow: 50 })
    );
    expect(result.data).toMatchObject({ responseAggregationType: "byPage", firstIncompleteDate: "2026-01-31" });
  });

  it("flags coverage as capped when the row count hits rowLimit, and leaves it uncapped otherwise", async () => {
    getWebsiteByDomain.mockResolvedValue(WEBSITE);
    getValidAccessToken.mockResolvedValue("token-123");

    // rowLimit: 1 hitting exactly 1 row triggers the export-superset probe
    // (see next test for when that probe actually finds more); here it
    // finds nothing extra, so scope_note falls back to the plain "narrow
    // the date range" wording instead of pointing at export_dataset.
    // Call order for this rowLimit:1 (truncated) invocation: primary
    // detail, primary totals, export-superset probe.
    const row = { keys: ["a"], clicks: 1, impressions: 1, ctr: 1, position: 1 };
    querySearchAnalytics
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] });
    const capped = await getSearchPerformance.handler(
      { domain: "example.com", startDate: "2026-01-01", endDate: "2026-01-31", rowLimit: 1 },
      fakeEnv()
    );
    expect(capped.coverage.scope_note).toContain("capped at 1 rows");
    expect(capped.coverage.scope_note).not.toContain("export_dataset");

    // rowLimit: 25 with only 1 row isn't truncated: just primary detail + primary totals, no superset probe.
    querySearchAnalytics.mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rows: [row] });
    const uncapped = await getSearchPerformance.handler(
      { domain: "example.com", startDate: "2026-01-01", endDate: "2026-01-31", rowLimit: 25 },
      fakeEnv()
    );
    expect(uncapped.coverage.scope_note).toBeNull();
  });

  it("fetches the immediately preceding period of equal length and adds summary + matched-row deltas", async () => {
    getWebsiteByDomain.mockResolvedValue(WEBSITE);
    getValidAccessToken.mockResolvedValue("token-123");

    // 2026-01-08..2026-01-14 is 7 days; the preceding 7-day period is 01-01..01-07.
    // Call order: primary detail, primary totals, previous detail, previous totals.
    querySearchAnalytics
      .mockResolvedValueOnce({ rows: [{ keys: ["resend alternatives"], clicks: 20, impressions: 200, ctr: 0.1, position: 4 }] })
      .mockResolvedValueOnce({ rows: [{ keys: [], clicks: 20, impressions: 200, ctr: 0.1, position: 4 }] })
      .mockResolvedValueOnce({ rows: [{ keys: ["resend alternatives"], clicks: 10, impressions: 100, ctr: 0.1, position: 6 }] })
      .mockResolvedValueOnce({ rows: [{ keys: [], clicks: 10, impressions: 100, ctr: 0.1, position: 6 }] });

    const result = await getSearchPerformance.handler(
      {
        domain: "example.com",
        startDate: "2026-01-08",
        endDate: "2026-01-14",
        compareToPreviousPeriod: true
      },
      fakeEnv()
    );

    expect(querySearchAnalytics).toHaveBeenNthCalledWith(
      3,
      "token-123",
      "sc-domain:example.com",
      expect.objectContaining({ startDate: "2026-01-01", endDate: "2026-01-07" })
    );
    expect(result.data).toMatchObject({ comparedToPreviousPeriod: true, previousPeriod: { startDate: "2026-01-01", endDate: "2026-01-07" } });

    const clicksDelta = result.deltas.find((d) => d.fact_type === "gsc.performance_summary" && d.field === "clicks");
    expect(clicksDelta).toMatchObject({ previous: 10, current: 20 });

    const rowClicksDelta = result.deltas.find((d) => d.fact_type === "gsc.query_performance" && d.field === "clicks");
    expect(rowClicksDelta).toMatchObject({ previous: 10, current: 20 });
  });

  it("never adds a row-level delta for a row with no match in the previous period's returned rows", async () => {
    getWebsiteByDomain.mockResolvedValue(WEBSITE);
    getValidAccessToken.mockResolvedValue("token-123");

    // Call order: primary detail, primary totals, previous detail, previous totals.
    querySearchAnalytics
      .mockResolvedValueOnce({ rows: [{ keys: ["brand new query"], clicks: 5, impressions: 50, ctr: 0.1, position: 8 }] })
      .mockResolvedValueOnce({ rows: [{ keys: [], clicks: 5, impressions: 50, ctr: 0.1, position: 8 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await getSearchPerformance.handler(
      { domain: "example.com", startDate: "2026-01-08", endDate: "2026-01-14", compareToPreviousPeriod: true },
      fakeEnv()
    );

    expect(result.deltas.filter((d) => d.fact_type === "gsc.query_performance")).toHaveLength(0);
    // The summary-level delta still exists (comparing 0 vs the new totals).
    expect(result.deltas.some((d) => d.fact_type === "gsc.performance_summary")).toBe(true);
  });

  it("adds no deltas at all when compareToPreviousPeriod isn't set", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    querySearchAnalytics.mockResolvedValue({ rows: [] });

    const result = await getSearchPerformance.handler(
      { domain: "example.com", startDate: "2026-01-01", endDate: "2026-01-31" },
      fakeEnv()
    );
    expect(result.deltas).toEqual([]);
    // Primary detail + primary totals, no previous-period calls.
    expect(querySearchAnalytics).toHaveBeenCalledTimes(2);
  });

  it("serves an identical second call from cache, without hitting Google again, and reports cache_hit on its facts", async () => {
    getWebsiteByDomain.mockResolvedValue(WEBSITE);
    getValidAccessToken.mockResolvedValue("token-123");
    querySearchAnalytics
      .mockResolvedValueOnce({ rows: [{ keys: ["resend alternatives"], clicks: 10, impressions: 100, ctr: 0.1, position: 5 }] })
      .mockResolvedValueOnce({ rows: [{ keys: [], clicks: 10, impressions: 100, ctr: 0.1, position: 5 }] });
    const env = fakeEnv();
    const args = { domain: "example.com", startDate: "2026-01-01", endDate: "2026-01-31" };

    const first = await getSearchPerformance.handler(args, env);
    expect(querySearchAnalytics).toHaveBeenCalledTimes(2);
    expect(first.facts[0]?.provenance.cache_hit).toBe(false);

    const second = await getSearchPerformance.handler(args, env);
    expect(querySearchAnalytics).toHaveBeenCalledTimes(2);
    expect(second.facts[0]?.provenance.cache_hit).toBe(true);
    // Same underlying data both times, cache_hit is the only thing that should differ.
    expect(second.facts.map((f) => f.data)).toEqual(first.facts.map((f) => f.data));
  });

  it("a fresh env (no shared cache) always re-fetches, tenant/query isolation matters more than reuse", async () => {
    getWebsiteByDomain.mockResolvedValue(WEBSITE);
    getValidAccessToken.mockResolvedValue("token-123");
    querySearchAnalytics.mockResolvedValue({ rows: [] });
    const args = { domain: "example.com", startDate: "2026-01-01", endDate: "2026-01-31" };

    await getSearchPerformance.handler(args, fakeEnv());
    await getSearchPerformance.handler(args, fakeEnv());
    // 2 calls per invocation (detail + totals) x 2 fresh envs.
    expect(querySearchAnalytics).toHaveBeenCalledTimes(4);
  });

  it("probes for more rows beyond rowLimit exactly once, and adds an export_dataset resource only when there really are more", async () => {
    getWebsiteByDomain.mockResolvedValue(WEBSITE);
    getValidAccessToken.mockResolvedValue("token-123");

    // Call order: primary detail (truncated at rowLimit:1), primary totals, export-superset probe (rowLimit:1000).
    const row = { keys: ["a"], clicks: 1, impressions: 1, ctr: 1, position: 1 };
    querySearchAnalytics
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row, row, row] });

    const result = await getSearchPerformance.handler(
      { domain: "example.com", startDate: "2026-01-01", endDate: "2026-01-31", rowLimit: 1 },
      fakeEnv()
    );

    expect(querySearchAnalytics).toHaveBeenNthCalledWith(3, "token-123", "sc-domain:example.com", expect.objectContaining({ rowLimit: 1000 }));
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]?.uri).toMatch(/^mcpseo:\/\//);
    expect(result.coverage.scope_note).toContain("export_dataset");
  });

  it("never probes for more rows when rowLimit already covers everything returned", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    querySearchAnalytics.mockResolvedValue({
      rows: [{ keys: ["a"], clicks: 1, impressions: 1, ctr: 1, position: 1 }]
    });

    const result = await getSearchPerformance.handler(
      { domain: "example.com", startDate: "2026-01-01", endDate: "2026-01-31", rowLimit: 25 },
      fakeEnv()
    );
    expect(querySearchAnalytics).toHaveBeenCalledTimes(2);
    expect(result.resources).toEqual([]);
  });
});
