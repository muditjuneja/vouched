import { z } from "zod";
import { domainMentionMetrics } from "../../clients/dataforseo/endpoints/llm-mentions";
import { envelope } from "../../envelope/builder";
import { domainEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  domain: z.string(),
  competitors: z.array(z.string()).max(5).optional().describe("Up to 5 competitors to compare against; each adds about $0.10 of market data"),
  platform: z.enum(["google", "chat_gpt"]).optional()
});

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const platform = args.platform ?? "google";
  const domains = [...new Set([args.domain, ...(args.competitors ?? [])])];

  // One mention-metrics call per domain; share of voice is each domain's
  // mentions over the total across the domains compared.
  const metrics = await Promise.all(domains.map((domain) => domainMentionMetrics(env, "inspect_ai_visibility", domain, platform)));
  const observedAt = new Date();
  const totals = metrics.map((m) => ({
    mentions: (m?.platform ?? []).reduce((sum, row) => sum + (row.mentions ?? 0), 0),
    aiSearchVolume: (m?.platform ?? []).reduce((sum, row) => sum + (row.ai_search_volume ?? 0), 0),
    topSources: (m?.sources_domain ?? []).slice(0, 5).map((row) => ({ domain: String(row.key), mentions: row.mentions ?? null }))
  }));
  const allMentions = totals.reduce((sum, t) => sum + t.mentions, 0);

  const builder = envelope("ai_visibility", { domain: args.domain, competitors: args.competitors ?? [], platform });
  domains.forEach((domain, i) => {
    const domainId = domainEntityId(domain);
    const t = totals[i]!;
    builder.addEntity({ id: domainId, kind: "domain", label: domain });
    builder.addFact({
      type: "ai_visibility.brand_mentions",
      subject: [domainId],
      data: {
        domain,
        is_you: domain === args.domain,
        mentions: t.mentions,
        ai_search_volume: t.aiSearchVolume,
        // Share of voice needs someone to share with: alone, it would always read 1.
        share_of_voice: domains.length > 1 && allMentions > 0 ? Math.round((t.mentions / allMentions) * 1000) / 1000 : null,
        top_cited_sources: t.topSources
      },
      provenance: provenance("ai_answer", "ai_answer_mentions", { observedAt, confidence: 0.5 })
    });
  });

  return builder
    .setCoverage({
      returned: domains.length,
      total: domains.length,
      as_of: observedAt.toISOString(),
      scope_note: `mentions in ${platform === "google" ? "Google AI Overviews" : "ChatGPT"} answers; share of voice is relative to the domains compared`
    })
    .build();
}

export const inspectAiVisibility: ToolModule<typeof inputSchema> = {
  name: "inspect_ai_visibility",
  title: "Inspect AI visibility",
  description: "How often a domain is mentioned in AI answers compared with up to 5 competitors, with share of voice. Costs about $0.10 of market data per domain compared (so $0.60 with 5 competitors), more than most tools. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
