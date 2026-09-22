import { describe, expect, it } from "vitest";
import { buildDiscoveredProperties } from "../../../src/dashboard/discovery";
import type { GA4Property } from "../../../src/clients/google/analytics-ga4";
import type { SearchConsoleSite } from "../../../src/clients/google/search-console";

function gscSite(siteUrl: string): SearchConsoleSite {
  return { siteUrl, permissionLevel: "siteOwner" };
}

function ga4Property(property: string, displayName: string, domain: string | null): GA4Property {
  return { property, displayName, domain };
}

describe("buildDiscoveredProperties", () => {
  it("turns a domain-property GSC site into a candidate keyed by its bare domain", () => {
    const result = buildDiscoveredProperties([gscSite("sc-domain:example.com")], [], new Set());
    expect(result).toEqual([{ name: "example.com", primaryDomain: "example.com", gscSiteUrl: "sc-domain:example.com", ga4PropertyId: null }]);
  });

  it("turns a URL-prefix GSC site into a candidate keyed by its hostname, stripping www", () => {
    const result = buildDiscoveredProperties([gscSite("https://www.example.com/")], [], new Set());
    expect(result).toEqual([{ name: "example.com", primaryDomain: "example.com", gscSiteUrl: "https://www.example.com/", ga4PropertyId: null }]);
  });

  it("matches a GA4 property onto the same candidate as a GSC site sharing its domain", () => {
    const result = buildDiscoveredProperties(
      [gscSite("sc-domain:example.com")],
      [ga4Property("properties/111", "Example Site", "example.com")],
      new Set()
    );
    expect(result).toEqual([
      { name: "example.com", primaryDomain: "example.com", gscSiteUrl: "sc-domain:example.com", ga4PropertyId: "properties/111" }
    ]);
  });

  it("adds a GA4-only property as its own candidate when no GSC site shares its domain", () => {
    const result = buildDiscoveredProperties([], [ga4Property("properties/111", "Example Site", "example.com")], new Set());
    expect(result).toEqual([{ name: "Example Site", primaryDomain: "example.com", gscSiteUrl: null, ga4PropertyId: "properties/111" }]);
  });

  it("skips a GA4 property with no resolvable domain: nothing to click-to-track without one", () => {
    const result = buildDiscoveredProperties([], [ga4Property("properties/111", "App Only", null)], new Set());
    expect(result).toEqual([]);
  });

  it("excludes a domain that's already tracked, whether the match came from GSC or GA4", () => {
    const result = buildDiscoveredProperties(
      [gscSite("sc-domain:tracked.com"), gscSite("sc-domain:new.com")],
      [ga4Property("properties/222", "Tracked Too", "tracked.com")],
      new Set(["tracked.com"])
    );
    expect(result).toEqual([{ name: "new.com", primaryDomain: "new.com", gscSiteUrl: "sc-domain:new.com", ga4PropertyId: null }]);
  });

  it("returns nothing when both lists are empty", () => {
    expect(buildDiscoveredProperties([], [], new Set())).toEqual([]);
  });
});
