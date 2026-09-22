import { UpstreamError } from "../../lib/errors";

export interface GA4Report {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: {
    dimensionValues: { value: string }[];
    metricValues: { value: string }[];
  }[];
}

export interface GA4ReportQuery {
  startDate: string;
  endDate: string;
  dimensions: string[];
  metrics: string[];
  limit?: number;
}

/** Plain REST call, no Google client library, see docs/ARCHITECTURE.md. */
export async function runReport(
  accessToken: string,
  propertyId: string,
  query: GA4ReportQuery
): Promise<GA4Report> {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: query.startDate, endDate: query.endDate }],
      dimensions: query.dimensions.map((name) => ({ name })),
      metrics: query.metrics.map((name) => ({ name })),
      limit: String(query.limit ?? 25)
    })
  });
  if (!res.ok) {
    throw new UpstreamError("ga4", await res.text(), res.status);
  }
  return res.json();
}

export interface GA4Property {
  /** e.g. "properties/123456789": the exact id runReport's propertyId param expects. */
  property: string;
  displayName: string;
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
    throw new UpstreamError("ga4", await res.text(), res.status);
  }
  const body = (await res.json()) as AccountSummariesResponse;
  return (body.accountSummaries ?? []).flatMap((account) =>
    (account.propertySummaries ?? []).map((p) => ({ property: p.property, displayName: p.displayName }))
  );
}
