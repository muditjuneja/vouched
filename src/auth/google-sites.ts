import { listPropertiesWithDomains } from "../clients/google/analytics-ga4";
import { listSites, type SearchConsoleSite } from "../clients/google/search-console";
import { gscSiteDomain } from "../dashboard/discovery";
import { addWebsite, getWebsiteByDomain, listWebsites, updateWebsite, type WebsiteRow } from "../db/websites";
import { normalizeDomain } from "../envelope/entities";
import type { Env } from "../types/env";
import type { ScopeGroup } from "../db/google-tokens";
import { checkConnectionState, getValidAccessToken } from "./google-oauth";

/** The Search Console property for `domain`: a domain property ("sc-domain:") covers every URL-prefix property for the same domain, so it wins. */
function searchConsoleSiteFor(sites: SearchConsoleSite[], domain: string): string | null {
  let found: string | null = null;
  for (const site of sites) {
    // An unverified user can't read the property's data.
    if (site.permissionLevel === "siteUnverifiedUser") continue;
    if (gscSiteDomain(site.siteUrl) !== domain) continue;
    if (!found || (site.siteUrl.startsWith("sc-domain:") && !found.startsWith("sc-domain:"))) found = site.siteUrl;
  }
  return found;
}

/** The connected Google account's property for `domain` in this scope, or null when it has none. */
async function googlePropertyFor(env: Env, domain: string, scopeGroup: ScopeGroup, tenantId: string | null): Promise<string | null> {
  const accessToken = await getValidAccessToken(env, scopeGroup, tenantId);
  if (scopeGroup === "webmaster_console") return searchConsoleSiteFor(await listSites(accessToken), domain);
  const property = (await listPropertiesWithDomains(accessToken)).find((p) => p.domain && normalizeDomain(p.domain) === domain);
  return property?.property ?? null;
}

/** The tracked website for `domain`, however its primary_domain was typed ("www.example.com", a URL, ...). */
async function trackedWebsite(env: Env, domain: string, tenantId: string | null): Promise<WebsiteRow | null> {
  const exact = await getWebsiteByDomain(env.DB, domain, tenantId);
  if (exact) return exact;
  const normalized = safeNormalize(domain);
  return (await listWebsites(env.DB, tenantId)).find((row) => safeNormalize(row.primary_domain) === normalized) ?? null;
}

/**
 * The tracked website for `domain`. When it isn't tracked yet, or has no
 * property for this scope, looks the domain up in the connected Google
 * account and tracks just that one site, so asking about a site works
 * without adding it by hand first. Only the requested domain is ever
 * added: a site someone deleted stays deleted until it's asked for again.
 * A property already linked is never replaced. Accepts "example.com",
 * "www.example.com" or a URL. Null when the account has no such property.
 */
export async function findWebsiteForScope(env: Env, domain: string, scopeGroup: ScopeGroup, tenantId: string | null): Promise<WebsiteRow | null> {
  const column = scopeGroup === "webmaster_console" ? "gsc_site_url" : "ga4_property_id";
  const website = await trackedWebsite(env, domain, tenantId);
  if (website?.[column]) return website;
  if ((await checkConnectionState(env, scopeGroup, tenantId)) !== "connected") return website;

  const normalized = safeNormalize(domain);
  try {
    const property = await googlePropertyFor(env, normalized, scopeGroup, tenantId);
    if (!property) return website;
    const link = scopeGroup === "webmaster_console" ? { gscSiteUrl: property } : { ga4PropertyId: property };
    if (website) return await updateWebsite(env.DB, website.website_id, link, tenantId);
    return await addWebsite(env.DB, { name: normalized, primaryDomain: normalized, ...link }, tenantId);
  } catch (error) {
    // A listing failure, or the same site added by a concurrent call a
    // moment ago: fall back to whatever is tracked now.
    console.warn(`[google sites] tracking ${domain} failed:`, error);
    return trackedWebsite(env, domain, tenantId);
  }
}

function safeNormalize(domain: string): string {
  try {
    return normalizeDomain(domain);
  } catch {
    return domain;
  }
}
