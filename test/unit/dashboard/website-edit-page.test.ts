import { describe, expect, it } from "vitest";
import { renderWebsiteEdit, type WebsiteEditData } from "../../../src/dashboard/pages/WebsiteEditPage";
import type { WebsiteRow } from "../../../src/db/websites";

function fakeWebsite(overrides: Partial<WebsiteRow> = {}): WebsiteRow {
  return {
    website_id: "w1",
    name: "Example",
    primary_domain: "example.com",
    is_default: 0,
    gsc_site_url: null,
    ga4_property_id: null,
    tenant_id: "t1",
    created_at: "2026-01-01",
    ...overrides
  };
}

function fakeData(overrides: Partial<WebsiteEditData> = {}): WebsiteEditData {
  return {
    website: fakeWebsite(),
    gscSites: null,
    ga4Properties: null,
    ...overrides
  };
}

describe("renderWebsiteEdit", () => {
  it("renders exactly one <h1> and posts to this website's own update route", () => {
    const html = renderWebsiteEdit(fakeData());
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toContain('action="/dashboard/websites/w1/update"');
  });

  it("escapes a tenant-controlled name safely", () => {
    const html = renderWebsiteEdit(fakeData({ website: fakeWebsite({ name: '"><script>alert(1)</script>' }) }));
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("pre-selects the website's current GSC site when a real picker is available", () => {
    const html = renderWebsiteEdit(
      fakeData({
        website: fakeWebsite({ gsc_site_url: "sc-domain:example.com" }),
        gscSites: [
          { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
          { siteUrl: "sc-domain:other.com", permissionLevel: "siteOwner" }
        ]
      })
    );
    const selectedIndex = html.indexOf('value="sc-domain:example.com" selected');
    expect(selectedIndex).toBeGreaterThan(-1);
  });

  it("falls back to a plain text input pre-filled with the current value when not connected", () => {
    const html = renderWebsiteEdit(fakeData({ website: fakeWebsite({ gsc_site_url: "sc-domain:example.com" }) }));
    expect(html).toContain('name="gscSiteUrl"');
    expect(html).toContain('value="sc-domain:example.com"');
    expect(html).not.toContain("<select");
  });
});
