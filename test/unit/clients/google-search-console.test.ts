import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listSites } from "../../../src/clients/google/search-console";

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
