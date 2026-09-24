import { z } from "zod";
import { topMentionedDomains } from "../../clients/dataforseo/endpoints/llm-mentions";
import { envelope } from "../../envelope/builder";
import { domainEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  topic: z.string().describe("The category/topic to check AI-citation sources for"),
  platform: z.enum(["google", "chat_gpt"]).optional().describe("google = AI Overview, chat_gpt = ChatGPT (default google)")
});

interface TopDomainItem {
  domain?: string;
  total?: { mentions?: number; ai_search_volume?: number };
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const platform = args.platform ?? "google";
  const items = (await topMentionedDomains(env, "discover_ai_citations", args.topic, platform)) as TopDomainItem[];
  const observedAt = new Date();

  const builder = envelope("ai_visibility", { topic: args.topic, platform });
  let returned = 0;
  items.forEach((item, index) => {
    if (!item.domain) return;
    returned++;
    const domainId = domainEntityId(item.domain);
    builder.addEntity({ id: domainId, kind: "domain", label: item.domain });
    builder.addFact({
      type: "ai_visibility.citation_source",
      subject: [domainId],
      data: {
        domain: item.domain,
        rank: index + 1,
        mentions: item.total?.mentions ?? null,
        ai_search_volume: item.total?.ai_search_volume ?? null
      },
      // Lower than a live SERP result: which sources an AI answer mentions
      // shifts more from day to day than an organic ranking does.
      provenance: provenance("ai_answer", "llm_mentions.top_mentioned_domains", { observedAt, confidence: 0.5 })
    });
  });

  return builder
    .setCoverage({ returned, total: null, as_of: observedAt.toISOString(), scope_note: `most-mentioned domains in ${platform === "google" ? "Google AI Overviews" : "ChatGPT"} answers for this topic` })
    .build();
}

export const discoverAiCitations: ToolModule<typeof inputSchema> = {
  name: "discover_ai_citations",
  title: "Discover AI citations",
  description: "Which websites AI answers (Google AI Overviews or ChatGPT) cite for a topic. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
