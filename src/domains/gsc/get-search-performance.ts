import { z } from "zod";
import { getValidAccessToken } from "../../auth/google-oauth";
import { querySearchAnalytics } from "../../clients/google/search-console";
import { getWebsiteByDomain } from "../../db/websites";
import { envelope } from "../../envelope/builder";
import { keywordEntityId, pageEntityId, propertyEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import { ConnectionRequiredError } from "../../lib/errors";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  domain: z.string().describe("A tracked website's primary_domain, e.g. example.com"),
  startDate: z.string().describe("YYYY-MM-DD"),
  endDate: z.string().describe("YYYY-MM-DD"),
  dimension: z.enum(["query", "page"]).optional().describe("Break rows down by query or page (default query)")
});

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const website = await getWebsiteByDomain(env.DB, args.domain);
  if (!website?.gsc_site_url) {
    throw new ConnectionRequiredError(
      "webmaster_console",
      `no Search Console site configured for ${args.domain} — add it to the websites table first`
    );
  }

  const dimension = args.dimension ?? "query";
  const accessToken = await getValidAccessToken(env, "webmaster_console");
  const result = await querySearchAnalytics(accessToken, website.gsc_site_url, {
    startDate: args.startDate,
    endDate: args.endDate,
    dimensions: [dimension]
  });

  const rows = result.rows ?? [];
  const observedAt = new Date();
  const propertyId = propertyEntityId(website.website_id);

  const totals = rows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      impressions: acc.impressions + row.impressions,
      weightedPosition: acc.weightedPosition + row.position * row.impressions
    }),
    { clicks: 0, impressions: 0, weightedPosition: 0 }
  );

  const builder = envelope("gsc", {
    domain: args.domain,
    startDate: args.startDate,
    endDate: args.endDate,
    dimension
  })
    .addEntity({ id: propertyId, kind: "property", label: website.name })
    .addFact({
      type: "gsc.performance_summary",
      subject: [propertyId],
      data: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        avg_position: totals.impressions > 0 ? totals.weightedPosition / totals.impressions : 0
      },
      provenance: provenance("webmaster_console", "gsc.searchAnalytics.query", { observedAt })
    });

  for (const row of rows) {
    const key = row.keys[0] ?? "";
    const subject = dimension === "page" ? pageEntityId(key) : keywordEntityId(key);
    if (dimension === "page") {
      builder.addEntity({ id: subject, kind: "page", label: key });
    } else {
      builder.addEntity({ id: subject, kind: "keyword", label: key });
    }
    builder.addFact({
      type: "gsc.query_performance",
      subject: [subject],
      data: { key, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position },
      provenance: provenance("webmaster_console", "gsc.searchAnalytics.query", { observedAt })
    });
  }

  return builder
    .setCoverage({ returned: rows.length, total: null, as_of: observedAt.toISOString(), scope_note: null })
    .build();
}

export const getSearchPerformance: ToolModule<typeof inputSchema> = {
  name: "get_search_performance",
  title: "Get search performance",
  description: "Query/page performance from Search Console.",
  inputSchema,
  handler
};
