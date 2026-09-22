import { describe, expect, it } from "vitest";
import { renderWebsites } from "../../../src/dashboard/pages/WebsitesPage";
import type { WebsitesData } from "../../../src/dashboard/types";

function fakeData(overrides: Partial<WebsitesData> = {}): WebsitesData {
  return {
    websites: [],
    googleOAuthConfigured: false,
    gscSites: null,
    ga4Properties: null,
    ...overrides
  };
}

describe("renderWebsites", () => {
  it("renders exactly one <h1>", () => {
    const html = renderWebsites(fakeData());
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
  });

  it("shows an empty state when there are no websites", () => {
    const html = renderWebsites(fakeData());
    expect(html).toContain("No websites tracked yet");
  });

  it("lists a tracked website with escaped, tenant-controlled text safe from injection", () => {
    const html = renderWebsites(
      fakeData({
        websites: [
          {
            row: {
              website_id: "w1",
              name: "<script>alert(1)</script>",
              primary_domain: "example.com",
              is_default: 0,
              gsc_site_url: null,
              ga4_property_id: null,
              tenant_id: "t1",
              created_at: "2026-01-01"
            },
            gsc: "not_configured",
            ga4: "not_configured"
          }
        ]
      })
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("links Edit/Delete actions to the right per-website routes", () => {
    const html = renderWebsites(
      fakeData({
        websites: [
          {
            row: {
              website_id: "w1",
              name: "Example",
              primary_domain: "example.com",
              is_default: 0,
              gsc_site_url: null,
              ga4_property_id: null,
              tenant_id: "t1",
              created_at: "2026-01-01"
            },
            gsc: "not_configured",
            ga4: "not_configured"
          }
        ]
      })
    );
    expect(html).toContain('href="/dashboard/websites/w1/edit"');
    expect(html).toContain('action="/dashboard/websites/w1/delete"');
  });

  it("falls back to plain text inputs when Google isn't connected (gscSites/ga4Properties null)", () => {
    const html = renderWebsites(fakeData());
    expect(html).toContain('name="gscSiteUrl"');
    expect(html).toContain("<input");
    expect(html).not.toContain("<select");
  });

  it("shows a real property picker instead of a text input once Google is connected", () => {
    const html = renderWebsites(
      fakeData({
        gscSites: [{ siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" }],
        ga4Properties: [{ property: "properties/123", displayName: "My Site" }]
      })
    );
    expect(html).toContain('<select name="gscSiteUrl"');
    expect(html).toContain('value="sc-domain:example.com"');
    expect(html).toContain('<select name="ga4PropertyId"');
    expect(html).toContain('value="properties/123"');
  });

  it("nudges the tenant to connect Google when it isn't connected yet, only when Google OAuth itself is configured on this deployment", () => {
    const notConfigured = renderWebsites(fakeData({ googleOAuthConfigured: false }));
    expect(notConfigured).not.toContain("Connect Google in");

    const configuredButNotConnected = renderWebsites(fakeData({ googleOAuthConfigured: true }));
    expect(configuredButNotConnected).toContain("Connect Google in");
  });

  it("doesn't show the connect nudge once both scopes are connected", () => {
    const html = renderWebsites(
      fakeData({
        googleOAuthConfigured: true,
        gscSites: [],
        ga4Properties: []
      })
    );
    expect(html).not.toContain("Connect Google in");
  });
});
