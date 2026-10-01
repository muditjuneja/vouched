import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionRequiredError, InvalidInputError } from "../../../../src/lib/errors";
import type { Env } from "../../../../src/types/env";

const { getWebsiteByDomain } = vi.hoisted(() => ({ getWebsiteByDomain: vi.fn() }));
vi.mock("../../../../src/db/websites", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/db/websites")>();
  return { ...actual, getWebsiteByDomain };
});

const { getValidAccessToken, checkConnectionState } = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(),
  // Not connected: an untracked site has nothing to import from.
  checkConnectionState: vi.fn(async () => "not_connected")
}));
vi.mock("../../../../src/auth/google-oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/auth/google-oauth")>();
  return { ...actual, getValidAccessToken, checkConnectionState };
});

const { inspectUrl } = vi.hoisted(() => ({ inspectUrl: vi.fn() }));
vi.mock("../../../../src/clients/google/search-console", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/clients/google/search-console")>();
  return { ...actual, inspectUrl };
});

import { inspectIndexing } from "../../../../src/domains/gsc/inspect-indexing";

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

function fakeEnv(): Env {
  return { DB: {} as D1Database, DATASETS: { put: vi.fn() } as unknown as R2Bucket, CACHE: fakeKv(), MCP_BEARER_TOKEN: "x" };
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

describe("inspect_indexing", () => {
  beforeEach(() => {
    getWebsiteByDomain.mockReset();
    getValidAccessToken.mockReset();
    inspectUrl.mockReset();
  });

  it("throws ConnectionRequiredError when the website has no gsc_site_url configured", async () => {
    getWebsiteByDomain.mockResolvedValueOnce({ ...WEBSITE, gsc_site_url: null });
    await expect(
      inspectIndexing.handler({ domain: "example.com", url: "https://example.com/page" }, fakeEnv())
    ).rejects.toThrow(ConnectionRequiredError);
  });

  it("emits an index_status fact plus property/page entities when indexStatusResult is present", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    inspectUrl.mockResolvedValueOnce({
      inspectionResultLink: "https://search.google.com/x",
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
        sitemap: [],
        referringUrls: []
      },
      mobileUsabilityResult: null,
      richResultsResult: null
    });

    const result = await inspectIndexing.handler({ domain: "example.com", url: "https://example.com/page" }, fakeEnv());

    expect(inspectUrl).toHaveBeenCalledWith("token-123", "sc-domain:example.com", "https://example.com/page");
    expect(result.entities).toContainEqual(expect.objectContaining({ kind: "page", label: "https://example.com/page" }));
    expect(result.entities).toContainEqual(expect.objectContaining({ kind: "property", label: "Example" }));
    const fact = result.facts.find((f) => f.type === "gsc.index_status");
    expect(fact?.data).toMatchObject({ verdict: "PASS", coverage_state: "Submitted and indexed", crawled_as: "MOBILE" });
    expect(result.facts.some((f) => f.type === "gsc.mobile_usability")).toBe(false);
    expect(result.facts.some((f) => f.type === "gsc.rich_results")).toBe(false);
  });

  it("emits rich_results when present, and never the retired mobile-usability report", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    inspectUrl.mockResolvedValueOnce({
      inspectionResultLink: null,
      indexStatusResult: null,
      mobileUsabilityResult: { verdict: "FAIL", issues: [{ issueType: "CLICKABLE_ELEMENTS_TOO_CLOSE" }] },
      richResultsResult: { verdict: "NEUTRAL", detectedItems: [] }
    });

    const result = await inspectIndexing.handler({ domain: "example.com", url: "https://example.com/page" }, fakeEnv());

    expect(result.facts.some((f) => f.type === "gsc.index_status")).toBe(false);
    expect(result.facts.some((f) => f.type === "gsc.mobile_usability")).toBe(false);
    const rich = result.facts.find((f) => f.type === "gsc.rich_results");
    expect(rich?.data).toEqual({ verdict: "NEUTRAL", detected_items: [] });
  });

  it("caches an identical second inspection, without calling inspectUrl again", async () => {
    getWebsiteByDomain.mockResolvedValue(WEBSITE);
    getValidAccessToken.mockResolvedValue("token-123");
    inspectUrl.mockResolvedValue({ inspectionResultLink: null, indexStatusResult: null, mobileUsabilityResult: null, richResultsResult: null });
    const env = fakeEnv();
    const args = { domain: "example.com", url: "https://example.com/page" };

    await inspectIndexing.handler(args, env);
    await inspectIndexing.handler(args, env);
    expect(inspectUrl).toHaveBeenCalledTimes(1);
  });

  it("rejects a URL outside the property with invalid_input, without calling Google", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    await expect(
      inspectIndexing.handler({ domain: "example.com", url: "https://other.com/page" }, fakeEnv())
    ).rejects.toThrow(InvalidInputError);
    expect(inspectUrl).not.toHaveBeenCalled();
  });
});
