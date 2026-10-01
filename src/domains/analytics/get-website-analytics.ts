import { z } from "zod";
import { getValidAccessToken } from "../../auth/google-oauth";
import { runReport } from "../../clients/google/analytics-ga4";
import { findWebsiteForScope } from "../../auth/google-sites";
import { envelope } from "../../envelope/builder";
import { pageEntityId, propertyEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import { ConnectionRequiredError } from "../../lib/errors";
import { assertDateRange, isoDate } from "../../lib/date-range";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const DEFAULT_LIMIT = 25;

const METRICS = ["sessions", "activeUsers", "engagementRate"] as const;

const inputSchema = z.object({
  domain: z.string().describe("Your site's domain, e.g. example.com: a tracked website, or any site the connected Google account can see"),
  startDate: isoDate,
  endDate: isoDate,
  dimension: z
    .enum(["date", "pagePath", "sessionSource"])
    .optional()
    .describe("Break rows down by date, page, or traffic source (default date)"),
  limit: z.number().int().min(1).max(1000).optional().describe("Max rows to return (default 25). The summary always covers every row.")
});

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  assertDateRange(args.startDate, args.endDate);
  const tenantId = env.__tenantId ?? null;
  const website = await findWebsiteForScope(env, args.domain, "analytics_property", tenantId);
  if (!website?.ga4_property_id) {
    throw new ConnectionRequiredError(
      "analytics_property",
      `No Google Analytics property found for ${args.domain}. Connect Google Analytics in the Vouched dashboard (Settings) with a Google account that has access to it, or open Websites, edit ${args.domain} and pick its GA4 property.`
    );
  }

  const dimension = args.dimension ?? "date";
  const accessToken = await getValidAccessToken(env, "analytics_property", tenantId);
  const report = await runReport(accessToken, website.ga4_property_id, {
    startDate: args.startDate,
    endDate: args.endDate,
    dimensions: [dimension],
    metrics: [...METRICS],
    limit: args.limit ?? DEFAULT_LIMIT,
    metricAggregations: ["TOTAL"]
  });

  const rows = report.rows ?? [];
  const observedAt = new Date();
  const propertyId = propertyEntityId(website.website_id);

  // GA4's own totals, not a sum over rows: rows are capped at the limit,
  // active users are deduplicated across days/pages/sources (so adding
  // rows double-counts), and engagementRate is a ratio that only averages
  // correctly weighted by sessions.
  const totalValues = report.totals?.[0]?.metricValues;
  const totalOf = (i: number): number | null => (totalValues?.[i]?.value != null ? Number(totalValues[i]!.value) : null);
  const sessions = totalOf(0) ?? 0;

  const builder = envelope("analytics", {
    domain: args.domain,
    startDate: args.startDate,
    endDate: args.endDate,
    dimension
  })
    .addEntity({ id: propertyId, kind: "property", label: website.name })
    .addFact({
      type: "analytics.traffic_summary",
      subject: [propertyId],
      data: {
        sessions,
        active_users: totalOf(1),
        avg_engagement_rate: sessions > 0 ? totalOf(2) : null
      },
      provenance: provenance("analytics_property", "ga4.runReport", { observedAt })
    });

  for (const row of rows) {
    const key = row.dimensionValues[0]?.value ?? "";
    let subject = propertyId;
    if (dimension === "pagePath") {
      subject = pageEntityId(new URL(key, `https://${website.primary_domain}`).toString());
      builder.addEntity({ id: subject, kind: "page", label: key });
    }
    builder.addFact({
      type: "analytics.traffic_by_dimension",
      subject: [subject],
      data: {
        key,
        sessions: Number(row.metricValues[0]?.value ?? 0),
        active_users: Number(row.metricValues[1]?.value ?? 0),
        engagement_rate: Number(row.metricValues[2]?.value ?? 0)
      },
      provenance: provenance("analytics_property", "ga4.runReport", { observedAt })
    });
  }

  const total = report.rowCount ?? null;
  const truncated = total !== null && total > rows.length;
  return builder
    .setCoverage({
      returned: rows.length,
      total,
      as_of: observedAt.toISOString(),
      scope_note: truncated
        ? `${total - rows.length} of ${total} ${dimension} rows not listed; the traffic_summary totals still include them. Raise limit (max 1000) to list more.`
        : null
    })
    .build();
}

export const getWebsiteAnalytics: ToolModule<typeof inputSchema> = {
  name: "get_website_analytics",
  title: "Get website analytics",
  description: "Sessions, users and engagement from your own Google Analytics (GA4) for one of your websites.",
  inputSchema,
  handler
};
