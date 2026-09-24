import { z } from "zod";
import { competitorsDomain } from "../../clients/dataforseo/endpoints/labs";
import { envelope } from "../../envelope/builder";
import { domainEntityId, normalizeDomain } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  domain: z.string().describe("The domain to find organic competitors for"),
  limit: z.number().int().min(1).max(100).optional()
});

interface CompetitorResult {
  domain?: string;
  avg_position?: number;
  intersections?: number;
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const results = (await competitorsDomain(
    env,
    "discover_competitors",
    args.domain,
    args.limit ?? 20
  )) as CompetitorResult[];
  const observedAt = new Date();

  const builder = envelope("seo", { domain: args.domain }).addEntity({
    id: domainEntityId(args.domain),
    kind: "domain",
    label: args.domain
  });

  // The endpoint lists the domain itself among its own competitors.
  const rivals = results.filter((item) => item.domain && normalizeDomain(item.domain) !== normalizeDomain(args.domain));
  for (const item of rivals) {
    if (!item.domain) continue;
    const competitorId = domainEntityId(item.domain);
    builder.addEntity({ id: competitorId, kind: "domain", label: item.domain });
    builder.addFact({
      type: "seo.competitor",
      subject: [domainEntityId(args.domain), competitorId],
      data: {
        competitor_domain: item.domain,
        avg_position: item.avg_position ?? null,
        shared_keyword_count: item.intersections ?? null
      },
      provenance: provenance("search_index", "labs.competitors_domain", { observedAt })
    });
  }

  return builder
    .setCoverage({ returned: rivals.length, total: null, as_of: observedAt.toISOString(), scope_note: null })
    .build();
}

export const discoverCompetitors: ToolModule<typeof inputSchema> = {
  name: "discover_competitors",
  title: "Discover competitors",
  description: "Find the domains competing with a site for the same organic keywords, ranked by keyword overlap. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
