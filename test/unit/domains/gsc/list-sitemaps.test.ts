import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionRequiredError } from "../../../../src/lib/errors";
import type { Env } from "../../../../src/types/env";

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

const { listSitemaps } = vi.hoisted(() => ({ listSitemaps: vi.fn() }));
vi.mock("../../../../src/clients/google/search-console", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/clients/google/search-console")>();
  return { ...actual, listSitemaps };
});

import { listSitemapsTool } from "../../../../src/domains/gsc/list-sitemaps";

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

const SITEMAP = {
  path: "https://example.com/sitemap.xml",
  lastSubmitted: "2026-01-01T00:00:00Z",
  lastDownloaded: "2026-01-02T00:00:00Z",
  isSitemapsIndex: false,
  isPending: false,
  warnings: 0,
  errors: 1,
  contents: [{ type: "web", submitted: 100, indexed: 90 }]
};

describe("list_sitemaps", () => {
  beforeEach(() => {
    getWebsiteByDomain.mockReset();
    getValidAccessToken.mockReset();
    listSitemaps.mockReset();
  });

  it("throws ConnectionRequiredError when the website has no gsc_site_url configured", async () => {
    getWebsiteByDomain.mockResolvedValueOnce({ ...WEBSITE, gsc_site_url: null });
    await expect(listSitemapsTool.handler({ domain: "example.com" }, fakeEnv())).rejects.toThrow(ConnectionRequiredError);
  });

  it("emits one gsc.sitemap_status fact per submitted sitemap", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    listSitemaps.mockResolvedValueOnce([SITEMAP]);

    const result = await listSitemapsTool.handler({ domain: "example.com" }, fakeEnv());

    expect(listSitemaps).toHaveBeenCalledWith("token-123", "sc-domain:example.com");
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toMatchObject({
      type: "gsc.sitemap_status",
      data: { path: "https://example.com/sitemap.xml", errors: 1, warnings: 0, contents: [{ type: "web", submitted: 100, indexed: 90 }] }
    });
    expect(result.coverage.returned).toBe(1);
  });

  it("surfaces the deprecated-indexed-count caveat so a real 0 never reads as a real signal", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    listSitemaps.mockResolvedValueOnce([SITEMAP]);

    const result = await listSitemapsTool.handler({ domain: "example.com" }, fakeEnv());
    expect(result.data.contentsIndexedCountCaveat).toMatch(/no longer populates/i);
  });

  it("gives a distinct empty-state scope_note when nothing is submitted", async () => {
    getWebsiteByDomain.mockResolvedValueOnce(WEBSITE);
    getValidAccessToken.mockResolvedValueOnce("token-123");
    listSitemaps.mockResolvedValueOnce([]);

    const result = await listSitemapsTool.handler({ domain: "example.com" }, fakeEnv());
    expect(result.facts).toHaveLength(0);
    expect(result.coverage.scope_note).toContain("no sitemaps submitted");
  });

  it("caches an identical second call, without calling listSitemaps again", async () => {
    getWebsiteByDomain.mockResolvedValue(WEBSITE);
    getValidAccessToken.mockResolvedValue("token-123");
    listSitemaps.mockResolvedValue([SITEMAP]);
    const env = fakeEnv();
    const args = { domain: "example.com" };

    await listSitemapsTool.handler(args, env);
    await listSitemapsTool.handler(args, env);
    expect(listSitemaps).toHaveBeenCalledTimes(1);
  });
});
