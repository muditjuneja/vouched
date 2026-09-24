import { z } from "zod";
import { organicSerp } from "../../clients/dataforseo/endpoints/serp";
import { envelope } from "../../envelope/builder";
import { domainEntityId, pageEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  keyword: z.string().describe("The search query to snapshot"),
  depth: z.number().int().min(1).max(100).optional().describe("How many organic results deep (default 20)")
});

interface SerpItem {
  type?: string;
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

  const builder = envelope("serp", { keyword: args.keyword, items_count: items.length });

  for (const item of items) {
    if (item.type === "organic" && item.url && item.domain) {
      const pageId = pageEntityId(item.url);
      builder
        .addEntity({ id: domainEntityId(item.domain), kind: "domain", label: item.domain })
        .addEntity({ id: pageId, kind: "page", label: item.url })
        .addFact({
          type: "serp.result",
          subject: [pageId],
          data: {
            position: item.rank_absolute ?? null,
            domain: item.domain,
            url: item.url,
            title: item.title ?? null
          },
          provenance: provenance("live_serp", "serp.google.organic.live.advanced", { observedAt })
        });
    } else if (item.type) {
      // Non-organic SERP furniture: featured snippet, People Also Ask, AI
      // Overview, etc. Presence/exact content of these is less stable than
      // an organic ranking, hence the lower confidence.
      builder.addFact({
        type: "serp.feature",
        subject: [],
        data: { feature_type: item.type, raw: item },
        provenance: provenance("live_serp", "serp.google.organic.live.advanced", {
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

export const inspectSerp: ToolModule<typeof inputSchema> = {
  name: "inspect_serp",
  title: "Inspect SERP",
  description: "Live Google results for one query: organic rankings plus features such as AI Overviews and People Also Ask. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
