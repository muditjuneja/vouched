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

/** One dimensionFilterGroups filter, GSC's real (slightly odd) shape: a flat list of filters, all AND-ed together within a group. */
export interface SearchAnalyticsFilter {
  dimension: "query" | "page" | "country" | "device";
  operator: "equals" | "contains" | "notContains" | "notEquals";
  expression: string;
}

export interface SearchAnalyticsQuery {
  startDate: string;
  endDate: string;
  dimensions: ("query" | "page" | "date" | "country" | "device")[];
  rowLimit?: number;
  /** All AND-ed together (GSC only supports one filter group per query at the level this client uses). */
  filters?: SearchAnalyticsFilter[];
}

/** Plain REST call, no Google client library, see docs/ARCHITECTURE.md. */
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
        rowLimit: query.rowLimit ?? 25,
        ...(query.filters && query.filters.length > 0 ? { dimensionFilterGroups: [{ filters: query.filters }] } : {})
      })
    }
  );
  if (!res.ok) {
    throw new UpstreamError("search_console", await res.text(), res.status);
  }
  return res.json();
}

export interface SearchConsoleSite {
  siteUrl: string;
  /** "siteOwner" | "siteFullUser" | "siteRestrictedUser" | "siteUnverifiedUser": Google's own verbatim enum. */
  permissionLevel: string;
}

interface SitesListResponse {
  siteEntry?: SearchConsoleSite[];
}

/**
 * Lists every Search Console property the connected Google account can
 * access, the real GSC `sites.list` endpoint (same `webmasters.readonly`
 * scope this app already requests, no new consent needed), letting the
 * dashboard offer a real property picker instead of a raw text field the
 * tenant has to hand-type an internal id into. Excludes
 * "siteUnverifiedUser" rows, which the account can see but can't actually
 * query search analytics for.
 */
export async function listSites(accessToken: string): Promise<SearchConsoleSite[]> {
  const res = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new UpstreamError("search_console", await res.text(), res.status);
  }
  const body = (await res.json()) as SitesListResponse;
  return (body.siteEntry ?? []).filter((site) => site.permissionLevel !== "siteUnverifiedUser");
}
