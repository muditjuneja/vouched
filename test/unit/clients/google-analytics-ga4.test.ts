import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProperties } from "../../../src/clients/google/analytics-ga4";

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
      { property: "properties/111", displayName: "Site A" },
      { property: "properties/222", displayName: "Site B" },
      { property: "properties/333", displayName: "Site C" }
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
