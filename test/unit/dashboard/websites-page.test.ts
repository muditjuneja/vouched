import { describe, expect, it } from "vitest";
import { renderWebsites } from "../../../src/dashboard/pages/WebsitesPage";
import type { WebsitesData } from "../../../src/dashboard/types";

function fakeData(overrides: Partial<WebsitesData> = {}): WebsitesData {
  return {
    websites: [],
    googleOAuthConfigured: false,
    gscState: "not_connected",
    ga4State: "not_connected",
    discovered: [],
    justConnected: null,
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

  it("has no manual name/domain form at all: nothing to type, only discovered properties to click", () => {
    const html = renderWebsites(fakeData({ googleOAuthConfigured: true, gscState: "connected", ga4State: "not_connected" }));
    expect(html).not.toContain('name="name"');
    expect(html).not.toContain('placeholder="My Site"');
    expect(html).not.toContain('placeholder="example.com"');
  });

  it("prompts to connect Google when nothing is connected yet, and lists discovered properties as one-click Track forms once something is", () => {
    const html = renderWebsites(
      fakeData({
        googleOAuthConfigured: true,
        gscState: "connected",
        ga4State: "not_connected",
        discovered: [{ name: "example.com", primaryDomain: "example.com", gscSiteUrl: "sc-domain:example.com", ga4PropertyId: null }]
      })
    );
    expect(html).toContain('action="/dashboard/websites"');
    expect(html).toContain('name="primaryDomain" value="example.com"');
    expect(html).toContain('name="gscSiteUrl" value="sc-domain:example.com"');
    expect(html).not.toContain('name="ga4PropertyId"');
    expect(html).toContain("Track");
  });

  it("shows a not-connected prompt, not an empty picker, when neither scope is connected", () => {
    const html = renderWebsites(fakeData({ googleOAuthConfigured: true }));
    expect(html).toContain("Connect or reconnect Search Console/Analytics above");
    expect(html).not.toContain("No new properties found");
  });

  it("shows a distinct empty state when connected but everything discoverable is already tracked", () => {
    const html = renderWebsites(fakeData({ googleOAuthConfigured: true, gscState: "connected", discovered: [] }));
    expect(html).toContain("No new properties found");
    expect(html).not.toContain("Connect or reconnect Search Console/Analytics above");
  });

  it("offers a direct Connect action in the Add-website widget when Google isn't connected yet, only when Google OAuth itself is configured on this deployment", () => {
    const notConfigured = renderWebsites(fakeData({ googleOAuthConfigured: false }));
    expect(notConfigured).not.toContain("/oauth/google/start?scope=webmaster_console&returnTo=websites");
    expect(notConfigured).toContain("Google OAuth isn&#39;t configured on this deployment yet");

    const configuredButNotConnected = renderWebsites(fakeData({ googleOAuthConfigured: true }));
    expect(configuredButNotConnected).toContain("/oauth/google/start?scope=webmaster_console&amp;returnTo=websites");
    expect(configuredButNotConnected).toContain("/oauth/google/start?scope=analytics_property&amp;returnTo=websites");
  });

  it("doesn't show the connect action once both scopes are connected", () => {
    const html = renderWebsites(
      fakeData({
        googleOAuthConfigured: true,
        gscState: "connected",
        ga4State: "connected",
        discovered: []
      })
    );
    expect(html).not.toContain("/oauth/google/start");
  });

  it("shows a confirmation banner right here when the tenant just connected from this page", () => {
    const html = renderWebsites(fakeData({ justConnected: "webmaster_console" }));
    expect(html).toContain("Search Console connected");
  });
});
