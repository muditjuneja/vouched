import { UpstreamError } from "../../lib/errors";

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchAnalyticsResponse {
  rows?: SearchAnalyticsRow[];
}

export interface SearchAnalyticsQuery {
  startDate: string;
  endDate: string;
  dimensions: ("query" | "page" | "date" | "country" | "device")[];
  rowLimit?: number;
}

/** Plain REST call — no Google client library, see docs/ARCHITECTURE.md. */
export async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  query: SearchAnalyticsQuery
): Promise<SearchAnalyticsResponse> {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        startDate: query.startDate,
        endDate: query.endDate,
        dimensions: query.dimensions,
        rowLimit: query.rowLimit ?? 25
      })
    }
  );
  if (!res.ok) {
    throw new UpstreamError("search_console", await res.text(), res.status);
  }
  return res.json();
}
