import { z } from "zod";
import { competitorsDomain, domainRankOverview, rankedKeywords } from "../../clients/dataforseo/endpoints/labs";
import { envelope } from "../../envelope/builder";
import { domainEntityId, keywordEntityId, normalizeDomain } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  domain: z.string().describe("The domain to snapshot")
});

interface RankOverviewResult {
  metrics?: { organic?: { etv?: number; count?: number } };
}
interface RankedKeywordResult {
  keyword_data?: { keyword?: string; keyword_info?: { search_volume?: number } };
  ranked_serp_element?: { serp_item?: { rank_group?: number; relative_url?: string } };
}
interface CompetitorResult {
  domain?: string;
  intersections?: number;
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  // Fans out to 3 DataForSEO calls (overview, top keywords, competitors),
  // folded into one envelope.
  const [overview, topKeywords, competitors] = await Promise.all([
    domainRankOverview(env, "inspect_domain", args.domain) as Promise<RankOverviewResult[]>,
    rankedKeywords(env, "inspect_domain", args.domain, { limit: 10 }) as Promise<RankedKeywordResult[]>,
    competitorsDomain(env, "inspect_domain", args.domain, 6) as Promise<CompetitorResult[]>
  ]);

  const observedAt = new Date();
  const domainId = domainEntityId(args.domain);
  const builder = envelope("seo", { domain: args.domain }).addEntity({
    id: domainId,
    kind: "domain",
    label: args.domain
  });

  builder.addFact({
    type: "seo.domain_summary",
    subject: [domainId],
    data: {
      estimated_organic_traffic: overview[0]?.metrics?.organic?.etv ?? null,
      ranked_keyword_count: overview[0]?.metrics?.organic?.count ?? null
    },
    provenance: provenance("search_index", "labs.domain_rank_overview", { observedAt })
  });

  for (const item of topKeywords) {
    const keyword = item.keyword_data?.keyword;
    if (!keyword) continue;
    const keywordId = keywordEntityId(keyword);
    builder.addEntity({ id: keywordId, kind: "keyword", label: keyword });
    builder.addFact({
      type: "seo.keyword_ranking",
      subject: [domainId, keywordId],
      data: {
        keyword,
        position: item.ranked_serp_element?.serp_item?.rank_group ?? null,
        search_volume: item.keyword_data?.keyword_info?.search_volume ?? null
      },
      provenance: provenance("search_index", "labs.ranked_keywords", { observedAt })
    });
  }

  // The endpoint lists the domain itself among its own competitors.
  const rivals = competitors.filter((item) => item.domain && normalizeDomain(item.domain) !== normalizeDomain(args.domain)).slice(0, 5);
  for (const item of rivals) {
    if (!item.domain) continue;
    const competitorId = domainEntityId(item.domain);
    builder.addEntity({ id: competitorId, kind: "domain", label: item.domain });
    builder.addFact({
      type: "seo.competitor",
      subject: [domainId, competitorId],
      data: { competitor_domain: item.domain, shared_keyword_count: item.intersections ?? null },
      provenance: provenance("search_index", "labs.competitors_domain", { observedAt })
    });
  }

  return builder
    .setCoverage({
      returned: 1 + topKeywords.length + rivals.length,
      total: null,
      as_of: observedAt.toISOString(),
      scope_note: "top 10 keywords and top 5 competitors only; use research_keywords/discover_competitors for more"
    })
    .build();
}

export const inspectDomain: ToolModule<typeof inputSchema> = {
  name: "inspect_domain",
  title: "Inspect domain",
  description: "One-call snapshot of a domain's organic search presence: estimated traffic, ranking keywords, top keywords and main competitors. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
