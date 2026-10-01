import { z } from "zod";
import { getValidAccessToken } from "../../auth/google-oauth";
import type { SearchAnalyticsFilter, SearchAnalyticsQuery, SearchAnalyticsRow } from "../../clients/google/search-console";
import { querySearchAnalytics } from "../../clients/google/search-console";
import { findWebsiteForScope } from "../../auth/google-sites";
import { envelope } from "../../envelope/builder";
import { keywordEntityId, pageEntityId, propertyEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Entity } from "../../envelope/types";
import { ConnectionRequiredError } from "../../lib/errors";
import { storeDataset, type FactDataset } from "../../resources/store";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";
import { cachedGscCall } from "./shared";

/**
 * GSC's own data is backfilled, not live: a completed date range's numbers
 * don't change on refetch, aside from the most recent day or two Google is
 * still finalizing. An hour is long enough to meaningfully cut repeat calls
 * within one agentic back-and-forth, short enough that a still-updating
 * "today" never goes seriously stale.
 */
const CACHE_TTL_SECONDS = 60 * 60;

/** The one export beyond a tenant's own requested rowLimit this tool ever fetches: Google's own per-call max. */
const EXPORT_ROW_LIMIT = 1000;

const DIMENSIONS = ["query", "page", "date", "hour", "country", "device", "searchAppearance"] as const;
type Dimension = (typeof DIMENSIONS)[number];

const FILTER_DIMENSIONS = ["query", "page", "country", "device", "searchAppearance"] as const;
const FILTER_OPERATORS = ["equals", "contains", "notContains", "notEquals", "includingRegex", "excludingRegex"] as const;

const inputSchema = z.object({
  domain: z.string().describe("Your site's domain, e.g. example.com: a tracked website, or any site the connected Google account can see"),
  startDate: z.string().describe("YYYY-MM-DD"),
  endDate: z.string().describe("YYYY-MM-DD"),
  dimensions: z
    .array(z.enum(DIMENSIONS))
    .min(1)
    .max(3)
    .optional()
    .describe(
      'Break rows down by up to 3 of query/page/date/hour/country/device/searchAppearance, in order (default ["query"]). E.g. ["query","device"] cross-tabs queries by device.'
    ),
  rowLimit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe("Max rows to return (default 25). Rows beyond this cap are dropped, not paginated; narrow the date range or add a filter instead of raising this into the hundreds."),
  startRow: z.number().int().min(0).optional().describe("Zero-based row offset for real pagination past one rowLimit-sized page (default 0)."),
  searchType: z
    .enum(["web", "image", "video", "news", "googleNews", "discover"])
    .optional()
    .describe("Which search surface to report on (default web, the combined 'All' tab). discover = Google Discover traffic, a major source this tool otherwise can't see at all."),
  dataState: z
    .enum(["final", "all"])
    .optional()
    .describe("'final' (default): only settled data. 'all': also includes the last day or two Google is still finalizing, so today/yesterday show up instead of a gap."),
  aggregationType: z
    .enum(["auto", "byPage", "byProperty"])
    .optional()
    .describe("How position is aggregated across dimensions (default auto, Google's own recommended choice; rarely needs overriding)."),
  device: z.enum(["DESKTOP", "MOBILE", "TABLET"]).optional().describe("Restrict to one device type."),
  country: z.string().length(3).optional().describe("Restrict to one ISO-3166-1 alpha-3 country code, e.g. usa."),
  queryContains: z.string().optional().describe("Restrict to queries containing this substring."),
  pageContains: z.string().optional().describe("Restrict to pages whose URL contains this substring."),
  searchAppearance: z
    .string()
    .optional()
    .describe("Restrict to one exact searchAppearance value (e.g. RICHCARD, AMP_TOP_STORIES); see a prior call's searchAppearance dimension values for what this property actually has."),
  customFilters: z
    .array(z.object({ dimension: z.enum(FILTER_DIMENSIONS), operator: z.enum(FILTER_OPERATORS), expression: z.string() }))
    .max(10)
    .optional()
    .describe("Advanced filters beyond the convenience args above: negated matches (notEquals/notContains) or RE2 regex (includingRegex/excludingRegex). AND-ed together with everything else."),
  compareToPreviousPeriod: z
    .boolean()
    .optional()
    .describe(
      "Also fetch the immediately preceding period of equal length and add deltas (clicks/impressions/ctr/position) to the summary and to any row whose dimension values also appear in that prior period's own top rowLimit rows."
    )
});

interface Totals {
  clicks: number;
  impressions: number;
  ctr: number;
  avg_position: number;
  [key: string]: number;
}

function computeTotals(rows: SearchAnalyticsRow[]): Totals {
  const sums = rows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      impressions: acc.impressions + row.impressions,
      weightedPosition: acc.weightedPosition + row.position * row.impressions
    }),
    { clicks: 0, impressions: 0, weightedPosition: 0 }
  );
  return {
    clicks: sums.clicks,
    impressions: sums.impressions,
    ctr: sums.impressions > 0 ? sums.clicks / sums.impressions : 0,
    avg_position: sums.impressions > 0 ? sums.weightedPosition / sums.impressions : 0
  };
}

/** The immediately preceding period of equal length (inclusive on both ends), e.g. Sep 8-14 -> Sep 1-7. */
function previousPeriod(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const dayMs = 86_400_000;
  const lengthDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
  const prevEnd = new Date(start.getTime() - dayMs);
  const prevStart = new Date(prevEnd.getTime() - (lengthDays - 1) * dayMs);
  return { startDate: prevStart.toISOString().slice(0, 10), endDate: prevEnd.toISOString().slice(0, 10) };
}

/**
 * Maps one row's dimension values onto entities/subjects: query -> a
 * keyword entity, page -> a page entity, both if a row has both. A row
 * broken down only by date/country/device (no query or page) has no
 * natural entity of its own, so it's subjected to the property instead.
 */
/**
 * Search Console queries aren't tied to one language or market like the
 * market-data tools' US English: keyword ids say "any" language and the
 * country filter if one was applied, otherwise GLOBAL.
 */
function rowSubjectsAndEntities(
  dims: Dimension[],
  keys: string[],
  propertyId: string,
  country: string | undefined
): { dimensionValues: Record<string, string>; subjects: string[]; entities: Entity[] } {
  const dimensionValues: Record<string, string> = {};
  const subjects: string[] = [];
  const entities: Entity[] = [];

  dims.forEach((dim, i) => {
    const value = keys[i] ?? "";
    dimensionValues[dim] = value;
    if (dim === "query") {
      const id = keywordEntityId(value, "any", country ? country.toUpperCase() : "GLOBAL");
      subjects.push(id);
      entities.push({ id, kind: "keyword", label: value });
    } else if (dim === "page") {
      const id = pageEntityId(value);
      subjects.push(id);
      entities.push({ id, kind: "page", label: value });
    }
  });

  if (subjects.length === 0) subjects.push(propertyId);
  return { dimensionValues, subjects, entities };
}

function buildFilters(args: z.infer<typeof inputSchema>): SearchAnalyticsFilter[] {
  const filters: SearchAnalyticsFilter[] = [];
  if (args.device) filters.push({ dimension: "device", operator: "equals", expression: args.device });
  if (args.country) filters.push({ dimension: "country", operator: "equals", expression: args.country.toLowerCase() });
  if (args.queryContains) filters.push({ dimension: "query", operator: "contains", expression: args.queryContains });
  if (args.pageContains) filters.push({ dimension: "page", operator: "contains", expression: args.pageContains });
  if (args.searchAppearance) filters.push({ dimension: "searchAppearance", operator: "equals", expression: args.searchAppearance });
  if (args.customFilters) filters.push(...args.customFilters);
  return filters;
}

/** Every live query this tool makes shares these base params (only rowLimit/startRow ever differ across the primary/previous-period/export-superset calls below). */
function baseQuery(args: z.infer<typeof inputSchema>, dims: Dimension[], filters: SearchAnalyticsFilter[]) {
  return {
    dimensions: dims,
    filters,
    ...(args.searchType ? { searchType: args.searchType } : {}),
    ...(args.dataState ? { dataState: args.dataState } : {}),
    ...(args.aggregationType ? { aggregationType: args.aggregationType } : {}),
    ...(args.startRow ? { startRow: args.startRow } : {})
  };
}

/**
 * The site-wide summary MUST come from its own request, not from summing
 * whatever page of detail rows happened to be fetched: GSC truncates
 * detail rows at rowLimit, so summing them silently under-reports whenever
 * a property has more distinct dimension values than rowLimit (confirmed:
 * a real query undercounted impressions by ~17x this way). Passing an
 * empty `dimensions` array is GSC's own documented way to get one
 * aggregate row for the whole date range/filter scope, independent of any
 * dimension breakdown or rowLimit.
 */
async function fetchTotals(
  env: Env,
  tenantId: string | null,
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  filters: SearchAnalyticsFilter[],
  searchType: z.infer<typeof inputSchema>["searchType"],
  dataState: z.infer<typeof inputSchema>["dataState"]
): Promise<{ totals: Totals; cacheHit: boolean; fetchedAt: Date }> {
  const query: SearchAnalyticsQuery = {
    startDate,
    endDate,
    dimensions: [],
    rowLimit: 1,
    filters,
    ...(searchType ? { searchType } : {}),
    ...(dataState ? { dataState } : {})
  };
  const { value: result, cacheHit, fetchedAt } = await cachedGscCall(
    env,
    tenantId,
    "get_search_performance",
    `${siteUrl}:${JSON.stringify(query)}`,
    CACHE_TTL_SECONDS,
    () => querySearchAnalytics(accessToken, siteUrl, query)
  );
  return { totals: computeTotals(result.rows ?? []), cacheHit, fetchedAt };
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const tenantId = env.__tenantId ?? null;
  const website = await findWebsiteForScope(env, args.domain, "webmaster_console", tenantId);
  if (!website?.gsc_site_url) {
    throw new ConnectionRequiredError(
      "webmaster_console",
      `No Search Console property found for ${args.domain}. Connect Search Console in the Vouched dashboard (Settings) with a Google account that has access to ${args.domain}, or check the domain is spelled the way Search Console lists it.`
    );
  }
  const siteUrl = website.gsc_site_url;

  const dims = args.dimensions ?? (["query"] as Dimension[]);
  const rowLimit = args.rowLimit ?? 25;
  const filters = buildFilters(args);
  const shared = baseQuery(args, dims, filters);
  const accessToken = await getValidAccessToken(env, "webmaster_console", tenantId);

  const primaryQuery: SearchAnalyticsQuery = { startDate: args.startDate, endDate: args.endDate, rowLimit, ...shared };
  const { value: result, cacheHit: detailCacheHit, fetchedAt: detailFetchedAt } = await cachedGscCall(
    env,
    tenantId,
    "get_search_performance",
    `${siteUrl}:${JSON.stringify(primaryQuery)}`,
    CACHE_TTL_SECONDS,
    () => querySearchAnalytics(accessToken, siteUrl, primaryQuery)
  );
  const rows = result.rows ?? [];
  const propertyId = propertyEntityId(website.website_id);
  const { totals, cacheHit: summaryCacheHit, fetchedAt: summaryFetchedAt } = await fetchTotals(
    env,
    tenantId,
    accessToken,
    siteUrl,
    args.startDate,
    args.endDate,
    filters,
    args.searchType,
    args.dataState
  );

  let previousRange: { startDate: string; endDate: string } | null = null;
  let previousTotals: Totals | null = null;
  let previousRowsByKey: Map<string, SearchAnalyticsRow> | null = null;
  if (args.compareToPreviousPeriod) {
    previousRange = previousPeriod(args.startDate, args.endDate);
    const previousQuery: SearchAnalyticsQuery = { startDate: previousRange.startDate, endDate: previousRange.endDate, rowLimit, ...shared };
    const { value: previousResult } = await cachedGscCall(
      env,
      tenantId,
      "get_search_performance",
      `${siteUrl}:${JSON.stringify(previousQuery)}`,
      CACHE_TTL_SECONDS,
      () => querySearchAnalytics(accessToken, siteUrl, previousQuery)
    );
    const previousRows = previousResult.rows ?? [];
    previousRowsByKey = new Map(previousRows.map((row) => [row.keys.join("␟"), row]));
    ({ totals: previousTotals } = await fetchTotals(
      env,
      tenantId,
      accessToken,
      siteUrl,
      previousRange.startDate,
      previousRange.endDate,
      filters,
      args.searchType,
      args.dataState
    ));
  }

  // The one place this tool ever fetches more than the tenant actually
  // asked for: only when rowLimit visibly truncated the primary query, and
  // only up to Google's own per-call max, so export_dataset has something
  // real to hand back instead of being permanently dead wiring (see
  // src/resources/store.ts's doc comment: nothing called storeDataset at
  // all before this).
  let exportUri: string | null = null;
  if (rows.length >= rowLimit && rowLimit < EXPORT_ROW_LIMIT) {
    const supersetQuery: SearchAnalyticsQuery = { startDate: args.startDate, endDate: args.endDate, rowLimit: EXPORT_ROW_LIMIT, ...shared };
    const { value: supersetResult, fetchedAt: supersetFetchedAt } = await cachedGscCall(
      env,
      tenantId,
      "get_search_performance",
      `${siteUrl}:${JSON.stringify(supersetQuery)}`,
      CACHE_TTL_SECONDS,
      () => querySearchAnalytics(accessToken, siteUrl, supersetQuery)
    );
    const supersetRows = supersetResult.rows ?? [];
    if (supersetRows.length > rows.length) {
      // The same facts the inline rows produce, so export_dataset hands back
      // an identical shape, just more of it.
      const entities = new Map<string, Entity>();
      const items = supersetRows.map((row) => {
        const built = rowSubjectsAndEntities(dims, row.keys, propertyId, args.country);
        for (const entity of built.entities) entities.set(entity.id, entity);
        return {
          subject: built.subjects,
          data: { dimensions: built.dimensionValues, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }
        };
      });
      const dataset: FactDataset = {
        version: 2,
        fact_type: "gsc.query_performance",
        source_class: "webmaster_console",
        method: "gsc.searchAnalytics.query",
        observed_at: supersetFetchedAt.toISOString(),
        capped: supersetRows.length >= EXPORT_ROW_LIMIT,
        row_limit: EXPORT_ROW_LIMIT,
        entities: [...entities.values()],
        items
      };
      exportUri = await storeDataset(env.DATASETS, "gsc", "get_search_performance", dataset, env.__tenantId ?? null);
    }
  }

  const builder = envelope("gsc", {
    domain: args.domain,
    startDate: args.startDate,
    endDate: args.endDate,
    responseAggregationType: result.responseAggregationType ?? null,
    firstIncompleteDate: result.metadata?.firstIncompleteDate ?? null,
    firstIncompleteHour: result.metadata?.firstIncompleteHour ?? null,
    dimensions: dims,
    rowLimit,
    filtersApplied: filters.length > 0,
    comparedToPreviousPeriod: Boolean(previousRange),
    previousPeriod: previousRange
  })
    .addEntity({ id: propertyId, kind: "property", label: website.name })
    .addFact({
      type: "gsc.performance_summary",
      subject: [propertyId],
      data: totals,
      provenance: provenance("webmaster_console", "gsc.searchAnalytics.query", { observedAt: summaryFetchedAt, cacheHit: summaryCacheHit })
    });

  if (exportUri) {
    builder.addResource({ uri: exportUri, description: `Up to ${EXPORT_ROW_LIMIT} rows for this same query, beyond the ${rowLimit} returned inline.` });
  }

  if (previousTotals) {
    for (const field of ["clicks", "impressions", "ctr", "avg_position"] as const) {
      builder.addDelta({
        subject: propertyId,
        fact_type: "gsc.performance_summary",
        field,
        previous: previousTotals[field],
        current: totals[field],
        observed_at: summaryFetchedAt.toISOString()
      });
    }
  }

  for (const row of rows) {
    const { dimensionValues, subjects, entities } = rowSubjectsAndEntities(dims, row.keys, propertyId, args.country);
    for (const entity of entities) builder.addEntity(entity);

    builder.addFact({
      type: "gsc.query_performance",
      subject: subjects,
      data: { dimensions: dimensionValues, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position },
      provenance: provenance("webmaster_console", "gsc.searchAnalytics.query", { observedAt: detailFetchedAt, cacheHit: detailCacheHit })
    });

    const previousRow = previousRowsByKey?.get(row.keys.join("␟"));
    if (previousRow) {
      const primarySubject = subjects[0] ?? propertyId;
      for (const [field, current, previous] of [
        ["clicks", row.clicks, previousRow.clicks],
        ["impressions", row.impressions, previousRow.impressions],
        ["ctr", row.ctr, previousRow.ctr],
        ["position", row.position, previousRow.position]
      ] as const) {
        builder.addDelta({
          subject: primarySubject,
          fact_type: "gsc.query_performance",
          field,
          previous,
          current,
          observed_at: detailFetchedAt.toISOString()
        });
      }
    }
  }

  return builder
    .setCoverage({
      returned: rows.length,
      total: null,
      as_of: new Date(Math.min(summaryFetchedAt.getTime(), detailFetchedAt.getTime())).toISOString(),
      scope_note:
        rows.length >= rowLimit
          ? exportUri
            ? `capped at ${rowLimit} rows; more are available via export_dataset`
            : `capped at ${rowLimit} rows, narrow the date range, add a filter, or raise rowLimit if you need more`
          : null
    })
    .build();
}

export const getSearchPerformance: ToolModule<typeof inputSchema> = {
  name: "get_search_performance",
  title: "Get search performance",
  description: "Query/page/date/country/device performance from Search Console, with optional filters and period-over-period comparison.",
  inputSchema,
  handler
};
