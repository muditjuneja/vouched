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

/** Plain REST call — no Google client library, see docs/ARCHITECTURE.md. */
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
