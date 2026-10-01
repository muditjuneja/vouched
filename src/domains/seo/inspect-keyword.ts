import { z } from "zod";
import { keywordOverview } from "../../clients/dataforseo/endpoints/labs";
import { envelope } from "../../envelope/builder";
import { keywordEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  keyword: z.string().describe("The keyword to inspect")
});

interface KeywordOverviewResult {
  keyword_info?: { search_volume?: number; cpc?: number; competition?: number };
  keyword_properties?: { keyword_difficulty?: number };
  search_intent_info?: { main_intent?: string };
}

/**
 * How big and how hard one keyword is, from the search index. Who ranks
 * for it right now is inspect_serp's job: the live page changes between
 * fetches, so one tool reads it, and two tools never disagree about it.
 */
async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const [overview] = (await keywordOverview(env, "inspect_keyword", [args.keyword])) as KeywordOverviewResult[];
  const observedAt = new Date();
  const keywordId = keywordEntityId(args.keyword);
  const metrics = {
    keyword: args.keyword,
    search_volume: overview?.keyword_info?.search_volume ?? null,
    cpc: overview?.keyword_info?.cpc ?? null,
    competition: overview?.keyword_info?.competition ?? null,
    keyword_difficulty: overview?.keyword_properties?.keyword_difficulty ?? null,
    search_intent: overview?.search_intent_info?.main_intent ?? null
  };

  const builder = envelope("seo", metrics)
    .addEntity({ id: keywordId, kind: "keyword", label: args.keyword })
    .addNextAction({ tool: "inspect_serp", args: { keyword: args.keyword }, use_when: "to see who ranks for it on Google right now" });
  if (overview) {
    builder.addFact({
      type: "seo.keyword_opportunity",
      subject: [keywordId],
      data: metrics,
      provenance: provenance("search_index", "keyword_overview", { observedAt })
    });
  }

  return builder
    .setCoverage({
      returned: overview ? 1 : 0,
      total: 1,
      as_of: observedAt.toISOString(),
      scope_note: overview ? null : "the index has no data for this keyword yet, usually because too few people search for it"
    })
    .build();
}

export const inspectKeyword: ToolModule<typeof inputSchema> = {
  name: "inspect_keyword",
  title: "Inspect keyword",
  description:
    "How big and how hard one keyword is: search volume, difficulty, CPC and intent. For who ranks for it right now, use inspect_serp. Paid market data (Pro and Team plans). A keyword_difficulty of 0 can mean the provider had too little data to score it, not that it's easy; check it against CPC and who ranks.",
  inputSchema,
  handler
};
