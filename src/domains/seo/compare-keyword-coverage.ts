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

interface IntersectionResult {
  keyword?: string;
  first_domain_serp_element?: { rank_absolute?: number } | null;
  second_domain_serp_element?: { rank_absolute?: number } | null;
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const observedAt = new Date();
  const domainId = domainEntityId(args.domain);
  const builder = envelope("seo", { domain: args.domain, competitors: args.competitors }).addEntity({
    id: domainId,
    kind: "domain",
    label: args.domain
  });

  let totalReturned = 0;

  // One domain_intersection call per competitor — DataForSEO's endpoint is
  // pairwise (target1/target2), so an N-way gap is N calls, not one.
  const perCompetitor = await Promise.all(
    args.competitors.map((competitor) =>
      domainIntersection(env, "compare_keyword_coverage", args.domain, competitor, 100).then(
        (results) => ({ competitor, results: results as IntersectionResult[] })
      )
    )
  );

  for (const { competitor, results } of perCompetitor) {
    totalReturned += results.length;
    const competitorId = domainEntityId(competitor);
    builder.addEntity({ id: competitorId, kind: "domain", label: competitor });

    for (const item of results) {
      if (!item.keyword) continue;
      const weRank = item.first_domain_serp_element != null;
      const theyRank = item.second_domain_serp_element != null;
      if (weRank && theyRank) continue; // not a gap either direction

      const keywordId = keywordEntityId(item.keyword);
      builder.addEntity({ id: keywordId, kind: "keyword", label: item.keyword });
      builder.addFact({
        type: "seo.keyword_opportunity",
        subject: [domainId, competitorId, keywordId],
        data: {
          keyword: item.keyword,
          gap_direction: theyRank ? "competitor_only" : "you_only",
          your_position: item.first_domain_serp_element?.rank_absolute ?? null,
          competitor_domain: competitor,
          competitor_position: item.second_domain_serp_element?.rank_absolute ?? null
        },
        provenance: provenance("search_index", "dataforseo_labs.domain_intersection", { observedAt })
      });
    }
  }

  return builder
    .setCoverage({ returned: totalReturned, total: null, as_of: observedAt.toISOString(), scope_note: null })
    .build();
}

export const compareKeywordCoverage: ToolModule<typeof inputSchema> = {
  name: "compare_keyword_coverage",
  title: "Compare keyword coverage",
  description: "Keyword gap vs competitors (requires a DataForSEO key).",
  inputSchema,
  handler
};
