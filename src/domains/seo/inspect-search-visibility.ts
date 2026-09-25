import { z } from "zod";
import { rankedKeywords } from "../../clients/dataforseo/endpoints/labs";
import { organicSerp } from "../../clients/dataforseo/endpoints/serp";
import { envelope } from "../../envelope/builder";
import { domainEntityId, keywordEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const LIVE_RECHECK_CAP = 10;

const inputSchema = z.object({
  domain: z.string(),
  keywords: z.array(z.string()).min(1).max(50),
  recheckLive: z
    .boolean()
    .optional()
    .describe(`Also live-check current SERP position for up to ${LIVE_RECHECK_CAP} of these keywords (extra cost)`)
});

interface RankedKeywordResult {
  keyword_data?: { keyword?: string };
  ranked_serp_element?: { serp_item?: { rank_group?: number } };
}
interface SerpItem {
  type?: string;
  rank_group?: number;
  domain?: string;
}
interface SerpResult {
  items?: SerpItem[];
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const observedAt = new Date();
  const domainId = domainEntityId(args.domain);
  const builder = envelope("seo", { domain: args.domain, keywords: args.keywords }).addEntity({
    id: domainId,
    kind: "domain",
    label: args.domain
  });

  // Filter syntax confirmed against the sandbox (it rejects unknown fields).
  const results = (await rankedKeywords(env, "inspect_search_visibility", args.domain, {
    limit: 1000,
    filters: ["keyword_data.keyword", "in", args.keywords]
  })) as RankedKeywordResult[];

  const foundKeywords = new Set<string>();
  for (const item of results) {
    const keyword = item.keyword_data?.keyword;
    if (!keyword) continue;
    foundKeywords.add(keyword);
    const keywordId = keywordEntityId(keyword);
    builder.addEntity({ id: keywordId, kind: "keyword", label: keyword });
    builder.addFact({
      type: "seo.keyword_ranking",
      subject: [domainId, keywordId],
      data: { keyword, ranking: true, position: item.ranked_serp_element?.serp_item?.rank_group ?? null },
      provenance: provenance("search_index", "ranked_keywords", { observedAt })
    });
  }

  for (const keyword of args.keywords) {
    if (!foundKeywords.has(keyword)) {
      // Explicitly not ranking (not in the top 100), rather than a missing value.
      const keywordId = keywordEntityId(keyword);
      builder.addEntity({ id: keywordId, kind: "keyword", label: keyword });
      builder.addFact({
        type: "seo.keyword_ranking",
        subject: [domainId, keywordId],
        data: { keyword, ranking: false, position: null },
        provenance: provenance("search_index", "ranked_keywords", {
          observedAt,
          confidence: 0.6
        })
      });
    }
  }

  if (args.recheckLive) {
    const toRecheck = args.keywords.slice(0, LIVE_RECHECK_CAP);
    const liveResults = await Promise.all(
      toRecheck.map((keyword) =>
        organicSerp(env, "inspect_search_visibility", keyword, 20).then(
          (r) => ({ keyword, items: (r as SerpResult[])[0]?.items ?? [] })
        )
      )
    );
    for (const { keyword, items } of liveResults) {
      const hit = items.find((item) => item.type === "organic" && item.domain?.includes(args.domain));
      builder.addFact({
        type: "seo.keyword_ranking",
        subject: [domainId, keywordEntityId(keyword)],
        data: { keyword, ranking: Boolean(hit), position: hit?.rank_group ?? null, live_recheck: true },
        provenance: provenance("live_serp", "google_serp", { observedAt })
      });
    }
  }

  return builder
    .setCoverage({
      returned: args.keywords.length,
      total: args.keywords.length,
      as_of: observedAt.toISOString(),
      scope_note: args.recheckLive
        ? "search_index rankings come from the last index crawl and can trail Google by days or weeks; live_recheck facts show the page right now"
        : "rankings come from the last index crawl and can trail Google by days or weeks; pass recheckLive: true to check the live results page"
    })
    .build();
}

export const inspectSearchVisibility: ToolModule<typeof inputSchema> = {
  name: "inspect_search_visibility",
  title: "Inspect search visibility",
  description: "Where a domain ranks in Google for a given list of keywords. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
