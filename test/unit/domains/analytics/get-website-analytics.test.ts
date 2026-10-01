import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebsiteRow } from "../../../../src/db/websites";
import { ConnectionRequiredError } from "../../../../src/lib/errors";
import type { Env } from "../../../../src/types/env";

const { getWebsiteByDomain, listWebsites, addWebsite, updateWebsite } = vi.hoisted(() => ({
  getWebsiteByDomain: vi.fn(async () => null),
  listWebsites: vi.fn(async () => []),
  addWebsite: vi.fn(),
  updateWebsite: vi.fn()
}));
vi.mock("../../../../src/db/websites", () => ({ getWebsiteByDomain, listWebsites, addWebsite, updateWebsite }));

const { getValidAccessToken, checkConnectionState } = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(async () => "token-123"),
  checkConnectionState: vi.fn(async () => "connected")
}));
vi.mock("../../../../src/auth/google-oauth", () => ({ getValidAccessToken, checkConnectionState }));

const { runReport, listPropertiesWithDomains } = vi.hoisted(() => ({ runReport: vi.fn(), listPropertiesWithDomains: vi.fn() }));
vi.mock("../../../../src/clients/google/analytics-ga4", () => ({ runReport, listPropertiesWithDomains }));

import { getWebsiteAnalytics } from "../../../../src/domains/analytics/get-website-analytics";

const env = { DB: {} } as unknown as Env;
const ARGS = { domain: "xmit.sh", startDate: "2026-09-01", endDate: "2026-09-30" };
const WEBSITE = { website_id: "w1", name: "xmit.sh", primary_domain: "xmit.sh", gsc_site_url: null, ga4_property_id: "properties/42" } as WebsiteRow;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("get_website_analytics", () => {
  it("tracks an untracked site from the connected account, then reports on its GA4 property", async () => {
    listPropertiesWithDomains.mockResolvedValueOnce([{ property: "properties/42", displayName: "xmit", domain: "www.xmit.sh" }]);
    addWebsite.mockResolvedValueOnce(WEBSITE);
    runReport.mockResolvedValueOnce({
      rows: [
        { dimensionValues: [{ value: "20260901" }], metricValues: [{ value: "10" }, { value: "8" }, { value: "0.5" }] },
        { dimensionValues: [{ value: "20260902" }], metricValues: [{ value: "20" }, { value: "12" }, { value: "0.7" }] }
      ]
    });

    const result = await getWebsiteAnalytics.handler(ARGS, env);

    expect(addWebsite).toHaveBeenCalledWith(env.DB, { name: "xmit.sh", primaryDomain: "xmit.sh", ga4PropertyId: "properties/42" }, null);
    expect(runReport).toHaveBeenCalledWith("token-123", "properties/42", expect.objectContaining({ dimensions: ["date"] }));
    expect(result.facts[0]).toMatchObject({ type: "analytics.traffic_summary", data: { sessions: 30, active_users: 20 } });
  });

  it("throws ConnectionRequiredError when the connected account has no property for the site", async () => {
    listPropertiesWithDomains.mockResolvedValueOnce([{ property: "properties/7", displayName: "other", domain: "other.com" }]);
    await expect(getWebsiteAnalytics.handler(ARGS, env)).rejects.toThrow(ConnectionRequiredError);
    expect(addWebsite).not.toHaveBeenCalled();
    expect(runReport).not.toHaveBeenCalled();
  });

  it("throws ConnectionRequiredError without calling Google when Analytics isn't connected", async () => {
    checkConnectionState.mockResolvedValueOnce("not_connected");
    await expect(getWebsiteAnalytics.handler(ARGS, env)).rejects.toThrow(ConnectionRequiredError);
    expect(listPropertiesWithDomains).not.toHaveBeenCalled();
  });
});
