import { z } from "zod";
import { organicSerp } from "../../clients/dataforseo/endpoints/serp";
import { envelope } from "../../envelope/builder";
import { domainEntityId, keywordEntityId, pageEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import { featureContent } from "./features";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  keyword: z.string().describe("The search query to snapshot"),
  depth: z.number().int().min(1).max(100).optional().describe("How many results to fetch, counting SERP features as well as organic results (default 20)")
});

interface SerpItem {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  title?: string;
  url?: string;
  description?: string;
}

interface SerpResult {
  keyword?: string;
  items?: SerpItem[];
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const results = (await organicSerp(
    env,
    "inspect_serp",
    args.keyword,
    args.depth ?? 20
  )) as SerpResult[];
  const items = results[0]?.items ?? [];
  const observedAt = new Date();

  const keywordId = keywordEntityId(args.keyword);
  const builder = envelope("serp", { keyword: args.keyword, items_count: items.length }).addEntity({
    id: keywordId,
    kind: "keyword",
    label: args.keyword
  });

  for (const item of items) {
    if (item.type === "organic" && item.url && item.domain) {
      const pageId = pageEntityId(item.url);
      builder
        .addEntity({ id: domainEntityId(item.domain), kind: "domain", label: item.domain })
        .addEntity({ id: pageId, kind: "page", label: item.url })
        .addFact({
          type: "serp.result",
          subject: [keywordId, pageId],
          data: {
            position: item.rank_group ?? null,
            domain: item.domain,
            url: item.url,
            title: item.title ?? null
          },
          provenance: provenance("live_serp", "google_serp", { observedAt })
        });
    } else if (item.type) {
      // Non-organic SERP furniture: featured snippet, People Also Ask, AI
      // Overview, etc. Presence/exact content of these is less stable than
      // an organic ranking, hence the lower confidence.
      builder.addFact({
        type: "serp.feature",
        subject: [keywordId],
        data: { feature_type: item.type, slot_on_page: item.rank_absolute ?? null, ...featureContent(item as unknown as Record<string, unknown>) },
        provenance: provenance("live_serp", "google_serp", {
          observedAt,
          confidence: 0.6
        })
      });
    }
  }

  return builder
    .setCoverage({
      returned: items.length,
      total: items.length,
      as_of: observedAt.toISOString(),
      scope_note: "depth counts every result on the page, SERP features included; organic positions exclude features"
    })
    .build();
}

export const inspectSerp: ToolModule<typeof inputSchema> = {
  name: "inspect_serp",
  title: "Inspect SERP",
  description: "Live Google results for one query: organic rankings plus features such as AI Overviews and People Also Ask. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
