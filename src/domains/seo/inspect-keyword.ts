import { z } from "zod";
import { keywordOverview } from "../../clients/dataforseo/endpoints/labs";
import { organicSerp } from "../../clients/dataforseo/endpoints/serp";
import { envelope } from "../../envelope/builder";
import { domainEntityId, keywordEntityId, pageEntityId } from "../../envelope/entities";
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
interface SerpItem {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  title?: string;
  url?: string;
}
interface SerpResult {
  items?: SerpItem[];
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const [overviewResults, serpResults] = await Promise.all([
    keywordOverview(env, "inspect_keyword", [args.keyword]) as Promise<KeywordOverviewResult[]>,
    organicSerp(env, "inspect_keyword", args.keyword, 20) as Promise<SerpResult[]>
  ]);

  const overview = overviewResults[0];
  const items = serpResults[0]?.items ?? [];
  const observedAt = new Date();
  const keywordId = keywordEntityId(args.keyword);

  // Per the confirmed manifest, this tool's only fact_types are serp.result
  // and serp.feature; keyword_overview's search_index data (volume/cpc/
  // difficulty/intent) lives in `data`, not as its own fact type.
  const builder = envelope("seo", {
    keyword: args.keyword,
    search_volume: overview?.keyword_info?.search_volume ?? null,
    cpc: overview?.keyword_info?.cpc ?? null,
    competition: overview?.keyword_info?.competition ?? null,
    keyword_difficulty: overview?.keyword_properties?.keyword_difficulty ?? null,
    search_intent: overview?.search_intent_info?.main_intent ?? null
  }).addEntity({ id: keywordId, kind: "keyword", label: args.keyword });

  for (const item of items) {
    if (item.type === "organic" && item.url && item.domain) {
      const pageId = pageEntityId(item.url);
      builder
        .addEntity({ id: domainEntityId(item.domain), kind: "domain", label: item.domain })
        .addEntity({ id: pageId, kind: "page", label: item.url })
        .addFact({
          type: "serp.result",
          subject: [keywordId, pageId],
          data: { position: item.rank_group ?? null, domain: item.domain, url: item.url, title: item.title ?? null },
          provenance: provenance("live_serp", "serp.google.organic", { observedAt })
        });
    } else if (item.type) {
      builder.addFact({
        type: "serp.feature",
        subject: [keywordId],
        data: { feature_type: item.type, slot_on_page: item.rank_absolute ?? null },
        provenance: provenance("live_serp", "serp.google.organic", {
          observedAt,
          confidence: 0.6
        })
      });
    }
  }

  return builder
    .setCoverage({ returned: items.length, total: items.length, as_of: observedAt.toISOString(), scope_note: null })
    .build();
}

export const inspectKeyword: ToolModule<typeof inputSchema> = {
  name: "inspect_keyword",
  title: "Inspect keyword",
  description: "Everything about one keyword: search volume, difficulty, CPC, intent, and who ranks for it right now. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
