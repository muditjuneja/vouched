import { googleUpstreamError } from "../../lib/errors";

export interface GA4Report {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: {
    dimensionValues: { value: string }[];
    metricValues: { value: string }[];
  }[];
  /** Present when the query asked for metricAggregations: ["TOTAL"]. Computed by GA4 over every row, not just the returned page. */
  totals?: { metricValues: { value: string }[] }[];
  rowCount?: number;
}

export interface GA4ReportQuery {
  startDate: string;
  endDate: string;
  dimensions: string[];
  metrics: string[];
  limit?: number;
  metricAggregations?: ("TOTAL" | "MAXIMUM" | "MINIMUM" | "COUNT")[];
}

/**
 * The Data API's resource name for a property: "properties/517891211".
 * The dashboard's manual field accepts the bare number people copy from
 * GA4's admin screen, so both forms are accepted and one is sent.
 */
export function ga4PropertyName(propertyId: string): string {
  const id = propertyId.trim();
  return /^\d+$/.test(id) ? `properties/${id}` : id;
}

/** Plain REST call, no Google client library, see docs/ARCHITECTURE.md. */
export async function runReport(
  accessToken: string,
  propertyId: string,
  query: GA4ReportQuery
): Promise<GA4Report> {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4PropertyName(propertyId)}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: query.startDate, endDate: query.endDate }],
      dimensions: query.dimensions.map((name) => ({ name })),
      metrics: query.metrics.map((name) => ({ name })),
      limit: String(query.limit ?? 25),
      ...(query.metricAggregations ? { metricAggregations: query.metricAggregations } : {})
    })
  });
  if (!res.ok) {
    throw await googleUpstreamError("ga4", res);
  }
  return res.json();
}

export interface GA4Property {
  /** e.g. "properties/123456789": the exact id runReport's propertyId param expects. */
  property: string;
  displayName: string;
  /** The property's web data stream's default URI, hostname-only, or null if it has no web stream (an app-only property) or the lookup failed. Lets the dashboard match a GA4 property onto the same domain as a Search Console site with zero tenant-typed input; see listPropertiesWithDomains. */
  domain: string | null;
}

interface AccountSummariesResponse {
  accountSummaries?: { propertySummaries?: { property: string; displayName: string }[] }[];
  nextPageToken?: string;
}

/**
 * Lists every GA4 property the connected Google account can access, via
 * the Admin API's `accountSummaries.list` (same `analytics.readonly`
 * scope this app already requests for the Data API above, no new consent
 * needed), letting the dashboard offer a real property picker instead of
 * a raw text field. Only the first page is fetched: reasonable for the
 * common case (most tenants have a handful of properties, not hundreds);
 * a tenant with enough properties to paginate would need this extended.
 */
export async function listProperties(accessToken: string): Promise<GA4Property[]> {
  const res = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw await googleUpstreamError("ga4", res);
  }
  const body = (await res.json()) as AccountSummariesResponse;
  return (body.accountSummaries ?? []).flatMap((account) =>
    (account.propertySummaries ?? []).map((p) => ({ property: p.property, displayName: p.displayName, domain: null }))
  );
}

interface DataStreamsResponse {
  dataStreams?: { type?: string; webStreamData?: { defaultUri?: string } }[];
}

/** Best-effort: a transient failure, a property with no web stream (app-only), or an unparseable defaultUri all just mean "no domain to match on", never a thrown error. */
async function fetchStreamDomain(accessToken: string, property: string): Promise<string | null> {
  try {
    const res = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${property}/dataStreams`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return null;
    const body = (await res.json()) as DataStreamsResponse;
    const defaultUri = body.dataStreams?.find((s) => s.type === "WEB_DATA_STREAM")?.webStreamData?.defaultUri;
    return defaultUri ? new URL(defaultUri).hostname : null;
  } catch {
    return null;
  }
}

/**
 * Same as listProperties, but also resolves each property's web stream
 * domain (one extra Admin API call per property, run in parallel) so the
 * dashboard can match a GA4 property onto the same tracked website as a
 * Search Console site with zero tenant-typed input (see
 * src/dashboard/discovery.ts). listProperties itself stays domain-less and
 * cheap for the edit page's plain picker, which doesn't need matching.
 */
export async function listPropertiesWithDomains(accessToken: string): Promise<GA4Property[]> {
  const properties = await listProperties(accessToken);
  return Promise.all(properties.map(async (p) => ({ ...p, domain: await fetchStreamDomain(accessToken, p.property) })));
}
