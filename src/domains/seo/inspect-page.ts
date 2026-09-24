import { z } from "zod";
import { rankedKeywords } from "../../clients/dataforseo/endpoints/labs";
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
    serp_item?: { relative_url?: string; rank_absolute?: number; etv?: number };
  };
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const url = new URL(args.url);
  const relativeUrl = url.pathname || "/";

  // NOTE: this `filters` shape (targeting ranked_serp_element.serp_item's
  // relative_url) follows DataForSEO's documented ranked_keywords filter
  // fields but (per client.ts's caveat) hasn't been confirmed against a
  // live call. If it's wrong, DataForSEO returns an empty/unfiltered
  // result rather than an error, so treat a suspiciously large or zero
  // result count here as a signal to re-check this filter at build time.
  const results = (await rankedKeywords(env, "inspect_page", url.hostname, {
    limit: 100,
    filters: [["ranked_serp_element.serp_item.relative_url", "=", relativeUrl]]
  })) as RankedKeywordResult[];

  const observedAt = new Date();
  const pageId = pageEntityId(args.url);
  const builder = envelope("seo", { url: args.url })
    .addEntity({ id: pageId, kind: "page", label: args.url })
    .addEntity({ id: domainEntityId(url.hostname), kind: "domain", label: url.hostname });

  for (const item of results) {
    const keyword = item.keyword_data?.keyword;
    if (!keyword) continue;
    const keywordId = keywordEntityId(keyword);
    builder.addEntity({ id: keywordId, kind: "keyword", label: keyword });
    builder.addFact({
      type: "seo.keyword_ranking",
      subject: [pageId, keywordId],
      data: {
        keyword,
        position: item.ranked_serp_element?.serp_item?.rank_absolute ?? null,
        search_volume: item.keyword_data?.keyword_info?.search_volume ?? null,
        estimated_traffic: item.ranked_serp_element?.serp_item?.etv ?? null,
        raw: item
      },
      provenance: provenance("search_index", "dataforseo_labs.ranked_keywords", { observedAt })
    });
  }

  builder.addFact({
    type: "seo.top_page",
    subject: [pageId],
    data: { url: args.url, ranked_keyword_count: results.length },
    provenance: provenance("search_index", "dataforseo_labs.ranked_keywords", { observedAt })
  });

  return builder
    .setCoverage({ returned: results.length, total: null, as_of: observedAt.toISOString(), scope_note: null })
    .build();
}

export const inspectPage: ToolModule<typeof inputSchema> = {
  name: "inspect_page",
  title: "Inspect page",
  description: "Ranking keywords and estimated traffic for a single URL. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
