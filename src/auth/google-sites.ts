import { listPropertiesWithDomains } from "../clients/google/analytics-ga4";
import { listSites, type SearchConsoleSite } from "../clients/google/search-console";
import { gscSiteDomain } from "../dashboard/discovery";
import { addWebsite, getWebsiteByDomain, listWebsites, updateWebsite, type WebsiteRow } from "../db/websites";
import { normalizeDomain } from "../envelope/entities";
import type { Env } from "../types/env";
import type { ScopeGroup } from "../db/google-tokens";
import { checkConnectionState, getValidAccessToken } from "./google-oauth";

/** One Search Console property per domain: a domain property ("sc-domain:") covers every URL-prefix property for the same domain, so it wins. */
function searchConsoleSitesByDomain(sites: SearchConsoleSite[]): Map<string, string> {
  const byDomain = new Map<string, string>();
  for (const site of sites) {
    // An unverified user can't read the property's data.
    if (site.permissionLevel === "siteUnverifiedUser") continue;
    const domain = gscSiteDomain(site.siteUrl);
    const current = byDomain.get(domain);
    if (!current || (site.siteUrl.startsWith("sc-domain:") && !current.startsWith("sc-domain:"))) {
      byDomain.set(domain, site.siteUrl);
    }
  }
  return byDomain;
}

/** The connected Google account's properties for this scope, keyed by domain. */
async function googlePropertiesByDomain(env: Env, scopeGroup: ScopeGroup, tenantId: string | null): Promise<Map<string, string>> {
  const accessToken = await getValidAccessToken(env, scopeGroup, tenantId);
  if (scopeGroup === "webmaster_console") return searchConsoleSitesByDomain(await listSites(accessToken));
  const byDomain = new Map<string, string>();
  for (const property of await listPropertiesWithDomains(accessToken)) {
    if (property.domain) byDomain.set(normalizeDomain(property.domain), property.property);
  }
  return byDomain;
}

/**
 * Tracks every site the connected Google account already has, so a new
 * workspace can query its Search Console or Analytics data straight away
 * instead of adding each site by hand first. Existing websites get the
 * property linked when theirs is empty; a property already linked is never
 * replaced. Returns how many websites were added.
 */
export async function importGoogleSites(env: Env, scopeGroup: ScopeGroup, tenantId: string | null): Promise<number> {
  const properties = await googlePropertiesByDomain(env, scopeGroup, tenantId);
  const tracked = new Map<string, WebsiteRow>((await listWebsites(env.DB, tenantId)).map((row) => [normalizeDomain(row.primary_domain), row]));
  const column = scopeGroup === "webmaster_console" ? "gsc_site_url" : "ga4_property_id";
  let added = 0;

  for (const [domain, property] of properties) {
    const link = scopeGroup === "webmaster_console" ? { gscSiteUrl: property } : { ga4PropertyId: property };
    const existing = tracked.get(domain);
    try {
      if (!existing) {
        await addWebsite(env.DB, { name: domain, primaryDomain: domain, ...link }, tenantId);
        added++;
      } else if (!existing[column]) {
        await updateWebsite(env.DB, existing.website_id, link, tenantId);
      }
    } catch (error) {
      // Added by a concurrent import a moment ago: nothing lost.
      console.warn(`[google sites] couldn't track ${domain}:`, error);
    }
  }
  return added;
}

/**
 * The tracked website for `domain`, importing from the connected Google
 * account first when it isn't tracked yet or has no property for this
 * scope. Accepts "example.com", "www.example.com" or a URL. Null when the
 * account really has no such property.
 */
export async function findWebsiteForScope(env: Env, domain: string, scopeGroup: ScopeGroup, tenantId: string | null): Promise<WebsiteRow | null> {
  const column = scopeGroup === "webmaster_console" ? "gsc_site_url" : "ga4_property_id";
  const lookup = async () =>
    (await getWebsiteByDomain(env.DB, domain, tenantId)) ?? (await getWebsiteByDomain(env.DB, safeNormalize(domain), tenantId));

  const website = await lookup();
  if (website?.[column]) return website;
  if ((await checkConnectionState(env, scopeGroup, tenantId)) !== "connected") return website;
  try {
    await importGoogleSites(env, scopeGroup, tenantId);
  } catch (error) {
    console.warn(`[google sites] import for ${domain} failed:`, error);
    return website;
  }
  return lookup();
}

function safeNormalize(domain: string): string {
  try {
    return normalizeDomain(domain);
  } catch {
    return domain;
  }
}
