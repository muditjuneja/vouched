import { normalizeDomain } from "../envelope/entities";
import type { GA4Property } from "../clients/google/analytics-ga4";
import type { SearchConsoleSite } from "../clients/google/search-console";

export interface DiscoveredProperty {
  name: string;
  primaryDomain: string;
  gscSiteUrl: string | null;
  ga4PropertyId: string | null;
}

/** GSC site URLs come as either "sc-domain:example.com" or a full URL-prefix property like "https://example.com/"; normalizeDomain only understands the latter shape. */
export function gscSiteDomain(siteUrl: string): string {
  return normalizeDomain(siteUrl.startsWith("sc-domain:") ? siteUrl.slice("sc-domain:".length) : siteUrl);
}

/**
 * Merges the tenant's live GSC sites and GA4 properties (matched onto each
 * other by domain, see GA4Property's domain field) into one "properties we
 * found in your Google account" list for the Add-website drawer, so
 * there's something to click instead of a blank form to fill in. Already-
 * tracked domains are excluded so the list only ever shows what's new.
 *
 * A GA4 property with no resolvable domain (an app-only property, or a
 * failed dataStreams lookup) is skipped rather than guessed at: there's
 * nothing to click-to-track without a domain, and this flow has no manual
 * fallback for the tenant to fill one in themselves.
 */
export function buildDiscoveredProperties(
  gscSites: SearchConsoleSite[],
  ga4Properties: GA4Property[],
  existingDomains: Set<string>
): DiscoveredProperty[] {
  const byDomain = new Map<string, DiscoveredProperty>();

  for (const site of gscSites) {
    const domain = gscSiteDomain(site.siteUrl);
    if (existingDomains.has(domain)) continue;
    byDomain.set(domain, { name: domain, primaryDomain: domain, gscSiteUrl: site.siteUrl, ga4PropertyId: null });
  }

  for (const property of ga4Properties) {
    if (!property.domain) continue;
    const domain = normalizeDomain(property.domain);
    if (existingDomains.has(domain)) continue;
    const existing = byDomain.get(domain);
    if (existing) {
      existing.ga4PropertyId = property.property;
    } else {
      byDomain.set(domain, { name: property.displayName || domain, primaryDomain: domain, gscSiteUrl: null, ga4PropertyId: property.property });
    }
  }

  return [...byDomain.values()];
}
