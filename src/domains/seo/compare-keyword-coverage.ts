import { z } from "zod";
import { domainIntersection } from "../../clients/dataforseo/endpoints/labs";
import { envelope } from "../../envelope/builder";
import { domainEntityId, keywordEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  domain: z.string().describe("Your domain"),
  competitors: z.array(z.string()).min(1).max(5).describe("Competitor domains to find keyword gaps against")
});

/** A keyword the competitor (target1) ranks for and the domain (target2) doesn't. */
interface GapItem {
  keyword_data?: { keyword?: string; keyword_info?: { search_volume?: number; cpc?: number }; keyword_properties?: { keyword_difficulty?: number } };
  first_domain_serp_element?: { rank_group?: number; url?: string; etv?: number } | null;
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const observedAt = new Date();
  const domainId = domainEntityId(args.domain);
  const builder = envelope("seo", { domain: args.domain, competitors: args.competitors }).addEntity({
    id: domainId,
    kind: "domain",
    label: args.domain
  });

  let returned = 0;

  // One call per competitor (the endpoint compares two domains):
  // competitor first, so the rows are keywords it ranks for and the domain doesn't.
  const perCompetitor = await Promise.all(
    args.competitors.map((competitor) =>
      domainIntersection(env, "compare_keyword_coverage", competitor, args.domain, 100).then((items) => ({
        competitor,
        items: items as GapItem[]
      }))
    )
  );

  for (const { competitor, items } of perCompetitor) {
    const competitorId = domainEntityId(competitor);
    builder.addEntity({ id: competitorId, kind: "domain", label: competitor });

    for (const item of items) {
      const keyword = item.keyword_data?.keyword;
      if (!keyword) continue;
      returned++;
      const keywordId = keywordEntityId(keyword);
      builder.addEntity({ id: keywordId, kind: "keyword", label: keyword });
      builder.addFact({
        type: "seo.keyword_opportunity",
        subject: [domainId, competitorId, keywordId],
        data: {
          keyword,
          search_volume: item.keyword_data?.keyword_info?.search_volume ?? null,
          keyword_difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty ?? null,
          competitor_domain: competitor,
          competitor_position: item.first_domain_serp_element?.rank_group ?? null,
          competitor_url: item.first_domain_serp_element?.url ?? null
        },
        provenance: provenance("search_index", "labs.domain_intersection", { observedAt })
      });
    }
  }

  return builder
    .setCoverage({
      returned,
      total: null,
      as_of: observedAt.toISOString(),
      scope_note: `keywords each competitor ranks for that ${args.domain} doesn't, up to 100 per competitor`
    })
    .build();
}

export const compareKeywordCoverage: ToolModule<typeof inputSchema> = {
  name: "compare_keyword_coverage",
  title: "Compare keyword coverage",
  description: "Keyword gap: keywords the competitors rank for that the domain doesn't, with volumes. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
