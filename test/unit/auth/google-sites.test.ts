import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebsiteRow } from "../../../src/db/websites";
import type { Env } from "../../../src/types/env";

const { getValidAccessToken, checkConnectionState } = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(async () => "token"),
  checkConnectionState: vi.fn(async () => "connected")
}));
vi.mock("../../../src/auth/google-oauth", () => ({ getValidAccessToken, checkConnectionState }));

const { listSites } = vi.hoisted(() => ({ listSites: vi.fn() }));
vi.mock("../../../src/clients/google/search-console", () => ({ listSites }));

const { listPropertiesWithDomains } = vi.hoisted(() => ({ listPropertiesWithDomains: vi.fn() }));
vi.mock("../../../src/clients/google/analytics-ga4", () => ({ listPropertiesWithDomains }));

/** An in-memory websites table behind the real db/websites functions' names. */
const rows: WebsiteRow[] = [];
vi.mock("../../../src/db/websites", () => ({
  listWebsites: vi.fn(async () => [...rows]),
  getWebsiteByDomain: vi.fn(async (_db: unknown, domain: string) => rows.find((row) => row.primary_domain === domain) ?? null),
  addWebsite: vi.fn(async (_db: unknown, input: { name: string; primaryDomain: string; gscSiteUrl?: string; ga4PropertyId?: string }) => {
    const row = {
      website_id: `w${rows.length + 1}`,
      name: input.name,
      primary_domain: input.primaryDomain,
      is_default: 0,
      gsc_site_url: input.gscSiteUrl ?? null,
      ga4_property_id: input.ga4PropertyId ?? null,
      tenant_id: "user_1",
      created_at: "2026-10-01"
    } as WebsiteRow;
    rows.push(row);
    return row;
  }),
  updateWebsite: vi.fn(async (_db: unknown, websiteId: string, input: { gscSiteUrl?: string; ga4PropertyId?: string }) => {
    const row = rows.find((r) => r.website_id === websiteId)!;
    if (input.gscSiteUrl !== undefined) row.gsc_site_url = input.gscSiteUrl;
    if (input.ga4PropertyId !== undefined) row.ga4_property_id = input.ga4PropertyId;
    return row;
  })
}));

import { findWebsiteForScope } from "../../../src/auth/google-sites";

const env = { DB: {} } as unknown as Env;

beforeEach(() => {
  rows.length = 0;
  vi.clearAllMocks();
});

describe("findWebsiteForScope", () => {
  it("tracks just the requested site from the connected account, preferring the domain property", async () => {
    listSites.mockResolvedValueOnce([
      { siteUrl: "https://xmit.sh/", permissionLevel: "siteOwner" },
      { siteUrl: "sc-domain:xmit.sh", permissionLevel: "siteOwner" },
      { siteUrl: "sc-domain:koin.theretrosaga.com", permissionLevel: "siteFullUser" }
    ]);
    const website = await findWebsiteForScope(env, "www.xmit.sh", "webmaster_console", "user_1");
    expect(website?.gsc_site_url).toBe("sc-domain:xmit.sh");
    expect(rows.map((r) => r.primary_domain)).toEqual(["xmit.sh"]);
  });

  it("doesn't track a property the account can't read", async () => {
    listSites.mockResolvedValueOnce([{ siteUrl: "sc-domain:not-mine.com", permissionLevel: "siteUnverifiedUser" }]);
    expect(await findWebsiteForScope(env, "not-mine.com", "webmaster_console", "user_1")).toBeNull();
    expect(rows).toEqual([]);
  });

  it("links Analytics to a site already tracked, however its domain was typed", async () => {
    rows.push({ website_id: "w1", name: "xmit", primary_domain: "https://www.xmit.sh/", gsc_site_url: "sc-domain:xmit.sh", ga4_property_id: null } as WebsiteRow);
    listPropertiesWithDomains.mockResolvedValueOnce([
      { property: "properties/3", displayName: "app only", domain: null },
      { property: "properties/517891211", displayName: "xmit", domain: "www.xmit.sh" }
    ]);
    const website = await findWebsiteForScope(env, "xmit.sh", "analytics_property", "user_1");
    expect(website?.website_id).toBe("w1");
    expect(website?.ga4_property_id).toBe("properties/517891211");
    expect(rows).toHaveLength(1);
  });

  it("never replaces a property someone picked", async () => {
    rows.push({ website_id: "w1", name: "koin", primary_domain: "koin.theretrosaga.com", gsc_site_url: null, ga4_property_id: "properties/1" } as WebsiteRow);
    expect((await findWebsiteForScope(env, "koin.theretrosaga.com", "analytics_property", "user_1"))?.ga4_property_id).toBe("properties/1");
    expect(listPropertiesWithDomains).not.toHaveBeenCalled();
  });

  it("finds a site passed as www or a URL without calling Google", async () => {
    rows.push({ website_id: "w1", name: "xmit.sh", primary_domain: "xmit.sh", gsc_site_url: "sc-domain:xmit.sh" } as WebsiteRow);
    expect((await findWebsiteForScope(env, "https://www.xmit.sh/", "webmaster_console", "user_1"))?.website_id).toBe("w1");
    expect(listSites).not.toHaveBeenCalled();
  });

  it("doesn't call Google when the scope isn't connected", async () => {
    checkConnectionState.mockResolvedValueOnce("not_connected");
    expect(await findWebsiteForScope(env, "xmit.sh", "webmaster_console", "user_1")).toBeNull();
    expect(listSites).not.toHaveBeenCalled();
  });

  it("falls back to what's tracked when Google can't be reached", async () => {
    listSites.mockRejectedValueOnce(new Error("503"));
    expect(await findWebsiteForScope(env, "xmit.sh", "webmaster_console", "user_1")).toBeNull();
  });
});
