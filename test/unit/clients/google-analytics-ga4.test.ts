import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ga4PropertyName, listProperties, listPropertiesWithDomains, runReport } from "../../../src/clients/google/analytics-ga4";
import { googleUpstreamError } from "../../../src/lib/errors";

describe("listProperties", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the real accountSummaries.list endpoint with a bearer token", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ accountSummaries: [] }), { status: 200 }));
    await listProperties("token-123");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
      expect.objectContaining({ headers: { Authorization: "Bearer token-123" } })
    );
  });

  it("flattens every account's properties into one list", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accountSummaries: [
            {
              account: "accounts/1",
              displayName: "Account A",
              propertySummaries: [{ property: "properties/111", displayName: "Site A" }]
            },
            {
              account: "accounts/2",
              displayName: "Account B",
              propertySummaries: [
                { property: "properties/222", displayName: "Site B" },
                { property: "properties/333", displayName: "Site C" }
              ]
            }
          ]
        }),
        { status: 200 }
      )
    );
    const properties = await listProperties("token-123");
    expect(properties).toEqual([
      { property: "properties/111", displayName: "Site A", domain: null },
      { property: "properties/222", displayName: "Site B", domain: null },
      { property: "properties/333", displayName: "Site C", domain: null }
    ]);
  });

  it("returns an empty array when the account has no properties at all", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    expect(await listProperties("token-123")).toEqual([]);
  });

  it("handles an account with no propertySummaries field", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ accountSummaries: [{ account: "accounts/1", displayName: "Empty" }] }), { status: 200 })
    );
    expect(await listProperties("token-123")).toEqual([]);
  });

  it("throws UpstreamError on a non-2xx response", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 403 }));
    await expect(listProperties("token-123")).rejects.toThrow();
  });
});

describe("listPropertiesWithDomains", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves each property's web stream domain via a per-property dataStreams call", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.endsWith("/accountSummaries")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ accountSummaries: [{ propertySummaries: [{ property: "properties/111", displayName: "Site A" }] }] }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ dataStreams: [{ type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "https://example.com" } }] }),
          { status: 200 }
        )
      );
    });
    const properties = await listPropertiesWithDomains("token-123");
    expect(properties).toEqual([{ property: "properties/111", displayName: "Site A", domain: "example.com" }]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://analyticsadmin.googleapis.com/v1beta/properties/111/dataStreams",
      expect.objectContaining({ headers: { Authorization: "Bearer token-123" } })
    );
  });

  it("skips a non-web stream (e.g. an app-only property) and reports no domain", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.endsWith("/accountSummaries")) {
        return Promise.resolve(
          new Response(JSON.stringify({ accountSummaries: [{ propertySummaries: [{ property: "properties/111", displayName: "App" }] }] }), {
            status: 200
          })
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ dataStreams: [{ type: "ANDROID_APP_DATA_STREAM" }] }), { status: 200 }));
    });
    const properties = await listPropertiesWithDomains("token-123");
    expect(properties).toEqual([{ property: "properties/111", displayName: "App", domain: null }]);
  });

  it("never throws when the dataStreams lookup itself fails: reports no domain instead", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.endsWith("/accountSummaries")) {
        return Promise.resolve(
          new Response(JSON.stringify({ accountSummaries: [{ propertySummaries: [{ property: "properties/111", displayName: "Site A" }] }] }), {
            status: 200
          })
        );
      }
      return Promise.resolve(new Response("nope", { status: 500 }));
    });
    const properties = await listPropertiesWithDomains("token-123");
    expect(properties).toEqual([{ property: "properties/111", displayName: "Site A", domain: null }]);
  });
});

describe("runReport", () => {
  const fetchSpy = vi.fn();
  const query = { startDate: "28daysAgo", endDate: "today", dimensions: ["date"], metrics: ["sessions"] };

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("calls properties/<id>:runReport whether the stored id has the prefix or not", async () => {
    for (const stored of ["517891211", "properties/517891211", " 517891211 "]) {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));
      await runReport("token", stored, query);
      expect(fetchSpy).toHaveBeenLastCalledWith("https://analyticsdata.googleapis.com/v1beta/properties/517891211:runReport", expect.anything());
    }
  });

  it("ga4PropertyName leaves anything that isn't a bare number alone", () => {
    expect(ga4PropertyName("517891211")).toBe("properties/517891211");
    expect(ga4PropertyName("properties/517891211")).toBe("properties/517891211");
  });
});

describe("googleUpstreamError", () => {
  it("keeps Google's own one-line reason from a JSON error", async () => {
    const res = new Response(JSON.stringify({ error: { code: 403, message: "User does not have sufficient permissions for this property.", status: "PERMISSION_DENIED" } }), { status: 403 });
    const error = await googleUpstreamError("ga4", res);
    expect(error.message).toBe("ga4: User does not have sufficient permissions for this property. (HTTP 403)");
  });

  it("keeps an OAuth error's description", async () => {
    const res = new Response(JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." }), { status: 400 });
    expect((await googleUpstreamError("google_oauth", res)).message).toBe("google_oauth: Token has been expired or revoked. (HTTP 400)");
  });

  it("never passes an HTML error page through", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const res = new Response("<!DOCTYPE html><html><style>body{}</style>Error 404 (Not Found)</html>", { status: 404 });
    const error = await googleUpstreamError("ga4", res);
    expect(error.message).toBe("ga4: request failed (HTTP 404)");
    expect(error.status).toBe(404);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
