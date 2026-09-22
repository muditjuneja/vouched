import { z } from "zod";
import { getValidAccessToken } from "../../auth/google-oauth";
import type { SearchAnalyticsFilter, SearchAnalyticsQuery, SearchAnalyticsResponse, SearchAnalyticsRow } from "../../clients/google/search-console";
import { querySearchAnalytics } from "../../clients/google/search-console";
import { getWebsiteByDomain } from "../../db/websites";
import { envelope } from "../../envelope/builder";
import { keywordEntityId, pageEntityId, propertyEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Entity } from "../../envelope/types";
import { getOrSetCache } from "../../lib/cache";
import { ConnectionRequiredError } from "../../lib/errors";
import { storeDataset } from "../../resources/store";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

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

const DIMENSIONS = ["query", "page", "date", "country", "device"] as const;
type Dimension = (typeof DIMENSIONS)[number];

const inputSchema = z.object({
  domain: z.string().describe("A tracked website's primary_domain, e.g. example.com"),
  startDate: z.string().describe("YYYY-MM-DD"),
  endDate: z.string().describe("YYYY-MM-DD"),
  dimensions: z
    .array(z.enum(DIMENSIONS))
    .min(1)
    .max(3)
    .optional()
    .describe(
      'Break rows down by up to 3 of query/page/date/country/device, in order (default ["query"]). E.g. ["query","device"] cross-tabs queries by device.'
    ),
  rowLimit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe("Max rows to return (default 25). Rows beyond this cap are dropped, not paginated; narrow the date range or add a filter instead of raising this into the hundreds."),
  device: z.enum(["DESKTOP", "MOBILE", "TABLET"]).optional().describe("Restrict to one device type."),
  country: z.string().length(3).optional().describe("Restrict to one ISO-3166-1 alpha-3 country code, e.g. usa."),
  queryContains: z.string().optional().describe("Restrict to queries containing this substring."),
  pageContains: z.string().optional().describe("Restrict to pages whose URL contains this substring."),
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
function rowSubjectsAndEntities(
  dims: Dimension[],
  keys: string[],
  propertyId: string
): { dimensionValues: Record<string, string>; subjects: string[]; entities: Entity[] } {
  const dimensionValues: Record<string, string> = {};
  const subjects: string[] = [];
  const entities: Entity[] = [];

  dims.forEach((dim, i) => {
    const value = keys[i] ?? "";
    dimensionValues[dim] = value;
    if (dim === "query") {
      const id = keywordEntityId(value);
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
  return filters;
}

/**
 * Every live GSC query this tool makes (the primary one, the previous-
 * period comparison, and the export-superset fetch below) funnels through
 * here, cached by its exact params. The KV entry expires on its TTL and is
 * the only copy kept.
 */
async function cachedQuery(
  env: Env,
  tenantId: string | null,
  accessToken: string,
  siteUrl: string,
  query: SearchAnalyticsQuery
): Promise<{ result: SearchAnalyticsResponse; cacheHit: boolean }> {
  const key = `gsc:${tenantId ?? "self-host"}:${siteUrl}:${JSON.stringify(query)}`;
  const { value, cacheHit } = await getOrSetCache(env.CACHE, key, CACHE_TTL_SECONDS, () => querySearchAnalytics(accessToken, siteUrl, query));
  return { result: value, cacheHit };
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const tenantId = env.__tenantId ?? null;
  const website = await getWebsiteByDomain(env.DB, args.domain, tenantId);
  if (!website?.gsc_site_url) {
    throw new ConnectionRequiredError(
      "webmaster_console",
      `no Search Console site configured for ${args.domain}, add it to the websites table first`
    );
  }

  const dims = args.dimensions ?? (["query"] as Dimension[]);
  const rowLimit = args.rowLimit ?? 25;
  const filters = buildFilters(args);
  const accessToken = await getValidAccessToken(env, "webmaster_console", tenantId);

  const { result, cacheHit } = await cachedQuery(env, tenantId, accessToken, website.gsc_site_url, {
    startDate: args.startDate,
    endDate: args.endDate,
    dimensions: dims,
    rowLimit,
    filters
  });
  const rows = result.rows ?? [];
  const observedAt = new Date();
  const propertyId = propertyEntityId(website.website_id);
  const totals = computeTotals(rows);

  let previousRange: { startDate: string; endDate: string } | null = null;
  let previousTotals: Totals | null = null;
  let previousRowsByKey: Map<string, SearchAnalyticsRow> | null = null;
  if (args.compareToPreviousPeriod) {
    previousRange = previousPeriod(args.startDate, args.endDate);
    const { result: previousResult } = await cachedQuery(env, tenantId, accessToken, website.gsc_site_url, {
      startDate: previousRange.startDate,
      endDate: previousRange.endDate,
      dimensions: dims,
      rowLimit,
      filters
    });
    const previousRows = previousResult.rows ?? [];
    previousTotals = computeTotals(previousRows);
    previousRowsByKey = new Map(previousRows.map((row) => [row.keys.join("␟"), row]));
  }

  // The one place this tool ever fetches more than the tenant actually
  // asked for: only when rowLimit visibly truncated the primary query, and
  // only up to Google's own per-call max, so export_dataset has something
  // real to hand back instead of being permanently dead wiring (see
  // src/resources/store.ts's doc comment: nothing called storeDataset at
  // all before this).
  let exportUri: string | null = null;
  if (rows.length >= rowLimit && rowLimit < EXPORT_ROW_LIMIT) {
    const { result: supersetResult } = await cachedQuery(env, tenantId, accessToken, website.gsc_site_url, {
      startDate: args.startDate,
      endDate: args.endDate,
      dimensions: dims,
      rowLimit: EXPORT_ROW_LIMIT,
      filters
    });
    const supersetRows = supersetResult.rows ?? [];
    if (supersetRows.length > rows.length) {
      exportUri = await storeDataset(env.DATASETS, "gsc", "get_search_performance", supersetRows);
    }
  }

  const builder = envelope("gsc", {
    domain: args.domain,
    startDate: args.startDate,
    endDate: args.endDate,
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
      provenance: provenance("webmaster_console", "gsc.searchAnalytics.query", { observedAt, cacheHit })
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
        observed_at: observedAt.toISOString()
      });
    }
  }

  for (const row of rows) {
    const { dimensionValues, subjects, entities } = rowSubjectsAndEntities(dims, row.keys, propertyId);
    for (const entity of entities) builder.addEntity(entity);

    builder.addFact({
      type: "gsc.query_performance",
      subject: subjects,
      data: { dimensions: dimensionValues, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position },
      provenance: provenance("webmaster_console", "gsc.searchAnalytics.query", { observedAt, cacheHit })
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
          observed_at: observedAt.toISOString()
        });
      }
    }
  }

  return builder
    .setCoverage({
      returned: rows.length,
      total: null,
      as_of: observedAt.toISOString(),
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
