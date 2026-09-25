import { z } from "zod";
import { rankedKeywordsPage } from "../../clients/dataforseo/endpoints/labs";
import { envelope } from "../../envelope/builder";
import { domainEntityId, keywordEntityId, pageEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  url: z.string().url().describe("The page to inspect")
});

interface RankedKeywordResult {
  keyword_data?: { keyword?: string; keyword_info?: { search_volume?: number } };
  ranked_serp_element?: {
    serp_item?: { relative_url?: string; rank_group?: number; etv?: number };
  };
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const url = new URL(args.url);
  const relativeUrl = url.pathname || "/";

  // Keywords the page ranks for: the host's ranked keywords, filtered to this
  // page's path. total_count is how many rank in all; up to 100 are listed.
  const { items: results, totalCount } = await rankedKeywordsPage(env, "inspect_page", url.hostname, {
    limit: 100,
    filters: ["ranked_serp_element.serp_item.relative_url", "=", relativeUrl]
  });

  const observedAt = new Date();
  const pageId = pageEntityId(args.url);
  const builder = envelope("seo", { url: args.url })
    .addEntity({ id: pageId, kind: "page", label: args.url })
    .addEntity({ id: domainEntityId(url.hostname), kind: "domain", label: url.hostname });

  for (const item of results as RankedKeywordResult[]) {
    const keyword = item.keyword_data?.keyword;
    if (!keyword) continue;
    const keywordId = keywordEntityId(keyword);
    builder.addEntity({ id: keywordId, kind: "keyword", label: keyword });
    builder.addFact({
      type: "seo.keyword_ranking",
      subject: [pageId, keywordId],
      data: {
        keyword,
        position: item.ranked_serp_element?.serp_item?.rank_group ?? null,
        search_volume: item.keyword_data?.keyword_info?.search_volume ?? null,
        estimated_traffic: item.ranked_serp_element?.serp_item?.etv ?? null
      },
      provenance: provenance("search_index", "ranked_keywords", { observedAt })
    });
  }

  builder.addFact({
    type: "seo.top_page",
    subject: [pageId],
    data: { url: args.url, ranked_keyword_count: totalCount ?? results.length },
    provenance: provenance("search_index", "ranked_keywords", { observedAt })
  });

  return builder
    .setCoverage({ returned: results.length, total: totalCount, as_of: observedAt.toISOString(), scope_note: null })
    .build();
}

export const inspectPage: ToolModule<typeof inputSchema> = {
  name: "inspect_page",
  title: "Inspect page",
  description: "Ranking keywords and estimated traffic for a single URL. Paid market data (Pro and Team plans). Inputs and output: https://vouchedhq.com/tools/inspect-page",
  inputSchema,
  handler
};
