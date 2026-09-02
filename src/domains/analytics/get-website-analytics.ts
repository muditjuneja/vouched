import { z } from "zod";
import { getValidAccessToken } from "../../auth/google-oauth";
import { runReport } from "../../clients/google/analytics-ga4";
import { getWebsiteByDomain } from "../../db/websites";
import { envelope } from "../../envelope/builder";
import { pageEntityId, propertyEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import { ConnectionRequiredError } from "../../lib/errors";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const METRICS = ["sessions", "activeUsers", "engagementRate"] as const;

const inputSchema = z.object({
  domain: z.string().describe("A tracked website's primary_domain, e.g. example.com"),
  startDate: z.string().describe("YYYY-MM-DD"),
  endDate: z.string().describe("YYYY-MM-DD"),
  dimension: z
    .enum(["date", "pagePath", "sessionSource"])
    .optional()
    .describe("Break rows down by date, page, or traffic source (default date)")
});

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const website = await getWebsiteByDomain(env.DB, args.domain);
  if (!website?.ga4_property_id) {
    throw new ConnectionRequiredError(
      "analytics_property",
      `no GA4 property configured for ${args.domain} — add it to the websites table first`
    );
  }

  const dimension = args.dimension ?? "date";
  const accessToken = await getValidAccessToken(env, "analytics_property");
  const report = await runReport(accessToken, website.ga4_property_id, {
    startDate: args.startDate,
    endDate: args.endDate,
    dimensions: [dimension],
    metrics: [...METRICS]
  });

  const rows = report.rows ?? [];
  const observedAt = new Date();
  const propertyId = propertyEntityId(website.website_id);

  const totals = rows.reduce(
    (acc, row) => ({
      sessions: acc.sessions + Number(row.metricValues[0]?.value ?? 0),
      activeUsers: acc.activeUsers + Number(row.metricValues[1]?.value ?? 0),
      engagementSum: acc.engagementSum + Number(row.metricValues[2]?.value ?? 0)
    }),
    { sessions: 0, activeUsers: 0, engagementSum: 0 }
  );

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
        sessions: totals.sessions,
        active_users: totals.activeUsers,
        avg_engagement_rate: rows.length > 0 ? totals.engagementSum / rows.length : 0
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

  return builder
    .setCoverage({ returned: rows.length, total: null, as_of: observedAt.toISOString(), scope_note: null })
    .build();
}

export const getWebsiteAnalytics: ToolModule<typeof inputSchema> = {
  name: "get_website_analytics",
  title: "Get website analytics",
  description: "Sessions/users/engagement from owned website analytics (GA4).",
  inputSchema,
  handler
};
