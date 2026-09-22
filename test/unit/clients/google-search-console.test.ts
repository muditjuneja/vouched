import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspectUrl, listSitemaps, listSites, querySearchAnalytics } from "../../../src/clients/google/search-console";

describe("listSites", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the real sites.list endpoint with a bearer token", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ siteEntry: [] }), { status: 200 }));
    await listSites("token-123");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://searchconsole.googleapis.com/webmasters/v3/sites",
      expect.objectContaining({ headers: { Authorization: "Bearer token-123" } })
    );
  });

  it("returns the verified sites, filtering out siteUnverifiedUser rows", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          siteEntry: [
            { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
            { siteUrl: "https://other.example.com/", permissionLevel: "siteUnverifiedUser" }
          ]
        }),
        { status: 200 }
      )
    );
    const sites = await listSites("token-123");
    expect(sites).toEqual([{ siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" }]);
  });

  it("returns an empty array when the account has no sites at all", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    expect(await listSites("token-123")).toEqual([]);
  });

  it("throws UpstreamError on a non-2xx response", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 401 }));
    await expect(listSites("token-123")).rejects.toThrow();
  });
});

describe("querySearchAnalytics", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function body(): Record<string, unknown> {
    return JSON.parse(fetchSpy.mock.calls.at(-1)![1].body as string);
  }

  it("sends multiple dimensions in the requested order", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    await querySearchAnalytics("token-123", "sc-domain:example.com", {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      dimensions: ["query", "device"]
    });
    expect(body().dimensions).toEqual(["query", "device"]);
  });

  it("defaults rowLimit to 25 when not given, and passes a custom one through", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    await querySearchAnalytics("token-123", "sc-domain:example.com", {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      dimensions: ["query"]
    });
    expect(body().rowLimit).toBe(25);

    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    await querySearchAnalytics("token-123", "sc-domain:example.com", {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      dimensions: ["query"],
      rowLimit: 100
    });
    expect(body().rowLimit).toBe(100);
  });

  it("omits dimensionFilterGroups entirely when no filters are given", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    await querySearchAnalytics("token-123", "sc-domain:example.com", {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      dimensions: ["query"]
    });
    expect(body()).not.toHaveProperty("dimensionFilterGroups");
  });

  it("wraps every filter into one AND-ed dimensionFilterGroups group", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    await querySearchAnalytics("token-123", "sc-domain:example.com", {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      dimensions: ["query"],
      filters: [
        { dimension: "device", operator: "equals", expression: "MOBILE" },
        { dimension: "query", operator: "contains", expression: "resend" }
      ]
    });
    expect(body().dimensionFilterGroups).toEqual([
      {
        filters: [
          { dimension: "device", operator: "equals", expression: "MOBILE" },
          { dimension: "query", operator: "contains", expression: "resend" }
        ]
      }
    ]);
  });

  it("throws UpstreamError on a non-2xx response", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 403 }));
    await expect(
      querySearchAnalytics("token-123", "sc-domain:example.com", { startDate: "2026-01-01", endDate: "2026-01-31", dimensions: ["query"] })
    ).rejects.toThrow();
  });

  it("passes searchType through as 'type', the field GSC's own API actually expects", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    await querySearchAnalytics("token-123", "sc-domain:example.com", {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      dimensions: ["query"],
      searchType: "discover"
    });
    expect(body().type).toBe("discover");
    expect(body()).not.toHaveProperty("searchType");
  });

  it("passes dataState, aggregationType, and startRow through untouched", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    await querySearchAnalytics("token-123", "sc-domain:example.com", {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      dimensions: ["query"],
      dataState: "all",
      aggregationType: "byPage",
      startRow: 50
    });
    expect(body()).toMatchObject({ dataState: "all", aggregationType: "byPage", startRow: 50 });
  });

  it("omits startRow/type/dataState/aggregationType entirely when not given, rather than sending them as undefined", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    await querySearchAnalytics("token-123", "sc-domain:example.com", { startDate: "2026-01-01", endDate: "2026-01-31", dimensions: ["query"] });
    const sent = body();
    expect(sent).not.toHaveProperty("startRow");
    expect(sent).not.toHaveProperty("type");
    expect(sent).not.toHaveProperty("dataState");
    expect(sent).not.toHaveProperty("aggregationType");
  });
});

describe("listSitemaps", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the real sitemaps.list endpoint for the given site", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ sitemap: [] }), { status: 200 }));
    await listSitemaps("token-123", "sc-domain:example.com");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/sitemaps",
      expect.objectContaining({ headers: { Authorization: "Bearer token-123" } })
    );
  });

  it("maps every field and coerces string-serialized counts to numbers", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sitemap: [
            {
              path: "https://example.com/sitemap.xml",
              lastSubmitted: "2026-01-01T00:00:00Z",
              lastDownloaded: "2026-01-02T00:00:00Z",
              isSitemapsIndex: false,
              isPending: false,
              warnings: "2",
              errors: "0",
              contents: [{ type: "web", submitted: "150", indexed: "140" }]
            }
          ]
        }),
        { status: 200 }
      )
    );
    const sitemaps = await listSitemaps("token-123", "sc-domain:example.com");
    expect(sitemaps).toEqual([
      {
        path: "https://example.com/sitemap.xml",
        lastSubmitted: "2026-01-01T00:00:00Z",
        lastDownloaded: "2026-01-02T00:00:00Z",
        isSitemapsIndex: false,
        isPending: false,
        warnings: 2,
        errors: 0,
        contents: [{ type: "web", submitted: 150, indexed: 140 }]
      }
    ]);
  });

  it("returns an empty array when the property has no sitemaps submitted", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    expect(await listSitemaps("token-123", "sc-domain:example.com")).toEqual([]);
  });

  it("throws UpstreamError on a non-2xx response", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 403 }));
    await expect(listSitemaps("token-123", "sc-domain:example.com")).rejects.toThrow();
  });
});

describe("inspectUrl", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts inspectionUrl + siteUrl to the v1 urlInspection endpoint", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ inspectionResult: {} }), { status: 200 }));
    await inspectUrl("token-123", "sc-domain:example.com", "https://example.com/page");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer token-123", "content-type": "application/json" },
        body: JSON.stringify({ inspectionUrl: "https://example.com/page", siteUrl: "sc-domain:example.com" })
      })
    );
  });

  it("maps indexStatusResult/mobileUsabilityResult/richResultsResult when present", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          inspectionResult: {
            inspectionResultLink: "https://search.google.com/search-console/inspect?...",
            indexStatusResult: {
              verdict: "PASS",
              coverageState: "Submitted and indexed",
              robotsTxtState: "ALLOWED",
              indexingState: "INDEXING_ALLOWED",
              lastCrawlTime: "2026-01-01T00:00:00Z",
              pageFetchState: "SUCCESSFUL",
              googleCanonical: "https://example.com/page",
              userCanonical: "https://example.com/page",
              crawledAs: "MOBILE",
              sitemap: ["https://example.com/sitemap.xml"],
              referringUrls: ["https://example.com/"]
            },
            mobileUsabilityResult: { verdict: "PASS", issues: [] },
            richResultsResult: { verdict: "NEUTRAL", detectedItems: [] }
          }
        }),
        { status: 200 }
      )
    );
    const result = await inspectUrl("token-123", "sc-domain:example.com", "https://example.com/page");
    expect(result.inspectionResultLink).toBe("https://search.google.com/search-console/inspect?...");
    expect(result.indexStatusResult).toMatchObject({ verdict: "PASS", coverageState: "Submitted and indexed", crawledAs: "MOBILE" });
    expect(result.mobileUsabilityResult).toEqual({ verdict: "PASS", issues: [] });
    expect(result.richResultsResult).toEqual({ verdict: "NEUTRAL", detectedItems: [] });
  });

  it("returns null for each sub-result the response doesn't include, never throws on a missing field", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ inspectionResult: {} }), { status: 200 }));
    const result = await inspectUrl("token-123", "sc-domain:example.com", "https://example.com/page");
    expect(result).toEqual({
      inspectionResultLink: null,
      indexStatusResult: null,
      mobileUsabilityResult: null,
      richResultsResult: null
    });
  });

  it("throws UpstreamError on a non-2xx response", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 403 }));
    await expect(inspectUrl("token-123", "sc-domain:example.com", "https://example.com/page")).rejects.toThrow();
  });
});
