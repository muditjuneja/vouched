import type { GA4Property } from "../../clients/google/analytics-ga4";
import type { SearchConsoleSite } from "../../clients/google/search-console";

/**
 * Renders a real picker (a <select> of the tenant's actual, live GSC
 * sites) when Google is connected and the listing call succeeded;
 * otherwise falls back to the same plain text input this always used to
 * be, so a self-host deployment (or a not-yet-connected/temporarily
 * unreachable Google account) never hits a dead end. This is the fix for
 * "why do I have to hand-type an internal Google id"; see WebsitesData's
 * doc comment.
 */
export function GscSiteField({ sites, value, error = null }: { sites: SearchConsoleSite[] | null; value?: string | null; error?: string | null }) {
  if (sites === null) {
    return (
      <>
        {error ? <p class="muted">{error}</p> : null}
        <input name="gscSiteUrl" placeholder="sc-domain:example.com (optional)" value={value ?? ""} />
      </>
    );
  }
  if (sites.length === 0) {
    return <p class="muted">No Search Console properties found for the connected Google account.</p>;
  }
  return (
    <select name="gscSiteUrl">
      <option value="">(none)</option>
      {sites.map((site) => (
        <option value={site.siteUrl} selected={site.siteUrl === value}>
          {site.siteUrl}
        </option>
      ))}
    </select>
  );
}

export function Ga4PropertyField({ properties, value, error = null }: { properties: GA4Property[] | null; value?: string | null; error?: string | null }) {
  if (properties === null) {
    return (
      <>
        {error ? <p class="muted">{error}</p> : null}
        <input name="ga4PropertyId" placeholder="properties/123456789 (optional)" value={value ?? ""} />
      </>
    );
  }
  if (properties.length === 0) {
    return <p class="muted">No Analytics properties found for the connected Google account.</p>;
  }
  return (
    <select name="ga4PropertyId">
      <option value="">(none)</option>
      {properties.map((property) => (
        <option value={property.property} selected={property.property === value}>
          {property.displayName} ({property.property})
        </option>
      ))}
    </select>
  );
}
