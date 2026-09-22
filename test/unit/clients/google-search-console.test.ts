import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listSites, querySearchAnalytics } from "../../../src/clients/google/search-console";

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
});
