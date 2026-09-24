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

interface CitationResult {
  domain?: string;
  mentions?: number;
  rank?: number;
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const platform = args.platform ?? "google";
  const results = (await topMentionedDomains(
    env,
    "discover_ai_citations",
    args.topic,
    platform
  )) as CitationResult[];
  const observedAt = new Date();

  const builder = envelope("ai_visibility", { topic: args.topic, platform });

  for (const item of results) {
    if (!item.domain) continue;
    const domainId = domainEntityId(item.domain);
    builder.addEntity({ id: domainId, kind: "domain", label: item.domain });
    builder.addFact({
      type: "ai_visibility.citation_source",
      subject: [domainId],
      data: { domain: item.domain, mentions: item.mentions ?? null, rank: item.rank ?? null, raw: item },
      // Confidence lower than a live SERP result: presence/ranking in an AI
      // answer is less stable and this endpoint's shape is unverified, see
      // clients/dataforseo/endpoints/llm-mentions.ts.
      provenance: provenance("ai_answer", "ai_optimization.llm_mentions.top_mentioned_domains", {
        observedAt,
        confidence: 0.5
      })
    });
  }

  builder.addFact({
    type: "core.data_freshness",
    subject: [],
    data: { platform, observed_at: observedAt.toISOString() },
    provenance: provenance("ai_answer", "ai_optimization.llm_mentions.top_mentioned_domains", {
      observedAt,
      confidence: 0.5
    })
  });

  return builder
    .setCoverage({ returned: results.length, total: null, as_of: observedAt.toISOString(), scope_note: null })
    .build();
}

export const discoverAiCitations: ToolModule<typeof inputSchema> = {
  name: "discover_ai_citations",
  title: "Discover AI citations",
  description: "Which websites AI answers (Google AI Overviews or ChatGPT) cite for a topic. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
