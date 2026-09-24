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
  /** Set only when dataState "all" + grouped by date/hour and the trailing period is still being finalized: everything from this point on may still change. */
  responseAggregationType?: "auto" | "byPage" | "byProperty";
  metadata?: { firstIncompleteDate?: string; firstIncompleteHour?: string };
}

/** One dimensionFilterGroups filter, GSC's real (slightly odd) shape: a flat list of filters, all AND-ed together within a group. */
export interface SearchAnalyticsFilter {
  dimension: "query" | "page" | "country" | "device" | "searchAppearance";
  operator: "equals" | "contains" | "notContains" | "notEquals" | "includingRegex" | "excludingRegex";
  expression: string;
}

export interface SearchAnalyticsQuery {
  startDate: string;
  endDate: string;
  dimensions: ("query" | "page" | "date" | "hour" | "country" | "device" | "searchAppearance")[];
  rowLimit?: number;
  /** Zero-based offset for real pagination beyond one rowLimit-sized page, GSC's own startRow param. */
  startRow?: number;
  /** GSC's "type" field (search surface): web (default) / image / video / news / googleNews / discover. Named searchType here since a bare "type" is meaningless out of context. */
  searchType?: "web" | "image" | "video" | "news" | "googleNews" | "discover";
  /** "final" (default, only settled data) or "all" (includes the last day or two of still-being-finalized data). */
  dataState?: "final" | "all" | "hourly_all";
  aggregationType?: "auto" | "byPage" | "byProperty" | "byNewsShowcasePanel";
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
        ...(query.startRow ? { startRow: query.startRow } : {}),
        ...(query.searchType ? { type: query.searchType } : {}),
        ...(query.dataState ? { dataState: query.dataState } : {}),
        ...(query.aggregationType ? { aggregationType: query.aggregationType } : {}),
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

export interface SitemapEntry {
  path: string;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  isSitemapsIndex: boolean;
  isPending: boolean;
  warnings: number;
  errors: number;
  /**
   * Per-content-type submitted/indexed counts, e.g. one entry for "web",
   * another for "image". `indexed` is confirmed-deprecated: Google's own
   * team acknowledged this stopped being populated and it always reports
   * 0 here regardless of real indexing state. Kept as-is (never silently
   * drop a real API field), but callers wanting an actual indexed/not
   * answer need `inspectUrl` instead, see list-sitemaps.ts's caveat.
   */
  contents: { type: string; submitted: number; indexed: number }[];
}

interface RawSitemapContent {
  type?: string;
  submitted?: number | string;
  indexed?: number | string;
}

interface RawSitemapEntry {
  path?: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isSitemapsIndex?: boolean;
  isPending?: boolean;
  warnings?: number | string;
  errors?: number | string;
  contents?: RawSitemapContent[];
}

interface SitemapsListResponse {
  sitemap?: RawSitemapEntry[];
}

/**
 * Lists every sitemap submitted for a site (`sitemaps.list`, same
 * `webmasters.readonly` scope, no new consent needed): last-read status,
 * warnings/errors, and per-content-type submitted counts (see
 * SitemapEntry's `contents[].indexed` doc comment: that specific count is
 * deprecated and always 0). This app had zero sitemap visibility before
 * this.
 */
export async function listSitemaps(accessToken: string, siteUrl: string): Promise<SitemapEntry[]> {
  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new UpstreamError("search_console", await res.text(), res.status);
  }
  const body = (await res.json()) as SitemapsListResponse;
  // warnings/errors/submitted/indexed can come back as JSON strings (Google
  // serializes large integer fields that way to avoid precision loss), so
  // every count here is coerced through Number() rather than assumed numeric.
  return (body.sitemap ?? []).map((entry) => ({
    path: entry.path ?? "",
    lastSubmitted: entry.lastSubmitted ?? null,
    lastDownloaded: entry.lastDownloaded ?? null,
    isSitemapsIndex: Boolean(entry.isSitemapsIndex),
    isPending: Boolean(entry.isPending),
    warnings: Number(entry.warnings ?? 0),
    errors: Number(entry.errors ?? 0),
    contents: (entry.contents ?? []).map((c) => ({
      type: c.type ?? "unknown",
      submitted: Number(c.submitted ?? 0),
      indexed: Number(c.indexed ?? 0)
    }))
  }));
}

export interface IndexStatusResult {
  /** "PASS" | "PARTIAL" | "FAIL" | "NEUTRAL" | "VERDICT_UNSPECIFIED": Google's own verbatim enum. */
  verdict: string;
  /** Free-text, e.g. "Submitted and indexed", "Crawled - currently not indexed": Google doesn't document this as a closed enum. */
  coverageState: string | null;
  /** "ALLOWED" | "DISALLOWED" | "ROBOTS_TXT_STATE_UNSPECIFIED". */
  robotsTxtState: string | null;
  /** "INDEXING_ALLOWED" | "BLOCKED_BY_META_TAG" | "BLOCKED_BY_HTTP_HEADER" | "BLOCKED_BY_ROBOTS_TXT" | "INDEXING_STATE_UNSPECIFIED". */
  indexingState: string | null;
  lastCrawlTime: string | null;
  /** "SUCCESSFUL" | "SOFT_404" | "NOT_FOUND" | "ACCESS_DENIED" | "SERVER_ERROR" | "REDIRECT_ERROR" | "ACCESS_FORBIDDEN" | "BLOCKED_4XX" | "BLOCKED_ROBOTS_TXT" | "INTERNAL_CRAWL_ERROR" | "INVALID_URL" | "PAGE_FETCH_STATE_UNSPECIFIED". */
  pageFetchState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  /** "DESKTOP" | "MOBILE" | "CRAWLING_USER_AGENT_UNSPECIFIED". */
  crawledAs: string | null;
  sitemap: string[];
  referringUrls: string[];
}

export interface MobileUsabilityResult {
  verdict: string;
  issues: { issueType?: string; severity?: string; message?: string }[];
}

export interface RichResultsResult {
  verdict: string;
  detectedItems: { richResultType?: string; items?: unknown[] }[];
}

export interface UrlInspectionResult {
  inspectionResultLink: string | null;
  indexStatusResult: IndexStatusResult | null;
  mobileUsabilityResult: MobileUsabilityResult | null;
  richResultsResult: RichResultsResult | null;
}

interface RawUrlInspectionResponse {
  inspectionResult?: {
    inspectionResultLink?: string;
    indexStatusResult?: Partial<IndexStatusResult>;
    mobileUsabilityResult?: Partial<MobileUsabilityResult>;
    richResultsResult?: Partial<RichResultsResult>;
    // ampResult deliberately unmapped: AMP is legacy/declining, and this
    // result's shape (a 5th, rarer nested object) isn't worth carrying
    // until something actually asks for it.
  };
}

/**
 * Google's own per-URL indexing diagnosis (`urlInspection.index:inspect`,
 * same `webmasters.readonly` scope, no new consent needed): is it actually
 * indexed, what canonical did Google choose, rich
 * results, last crawl. A different API version/host from the rest of this
 * file (`/v1/` not `/webmasters/v3/`) but the same underlying product.
 */
export async function inspectUrl(accessToken: string, siteUrl: string, inspectionUrl: string): Promise<UrlInspectionResult> {
  const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ inspectionUrl, siteUrl })
  });
  if (!res.ok) {
    throw new UpstreamError("search_console", await res.text(), res.status);
  }
  const body = (await res.json()) as RawUrlInspectionResponse;
  const result = body.inspectionResult;
  const index = result?.indexStatusResult;
  const mobile = result?.mobileUsabilityResult;
  const rich = result?.richResultsResult;

  return {
    inspectionResultLink: result?.inspectionResultLink ?? null,
    indexStatusResult: index
      ? {
          verdict: index.verdict ?? "VERDICT_UNSPECIFIED",
          coverageState: index.coverageState ?? null,
          robotsTxtState: index.robotsTxtState ?? null,
          indexingState: index.indexingState ?? null,
          lastCrawlTime: index.lastCrawlTime ?? null,
          pageFetchState: index.pageFetchState ?? null,
          googleCanonical: index.googleCanonical ?? null,
          userCanonical: index.userCanonical ?? null,
          crawledAs: index.crawledAs ?? null,
          sitemap: index.sitemap ?? [],
          referringUrls: index.referringUrls ?? []
        }
      : null,
    mobileUsabilityResult: mobile ? { verdict: mobile.verdict ?? "VERDICT_UNSPECIFIED", issues: mobile.issues ?? [] } : null,
    richResultsResult: rich ? { verdict: rich.verdict ?? "VERDICT_UNSPECIFIED", detectedItems: rich.detectedItems ?? [] } : null
  };
}
