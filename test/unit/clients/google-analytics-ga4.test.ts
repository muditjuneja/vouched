import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProperties, listPropertiesWithDomains } from "../../../src/clients/google/analytics-ga4";

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
