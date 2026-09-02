import { z } from "zod";
import { searchMentions } from "../../clients/dataforseo/endpoints/llm-mentions";
import { envelope } from "../../envelope/builder";
import { domainEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  domain: z.string(),
  competitors: z.array(z.string()).max(5).optional().describe("Named competitors to compare against"),
  platform: z.enum(["google", "chat_gpt"]).optional()
});

interface MentionResult {
  target?: string;
  mentions?: number;
  share_of_voice?: number;
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const platform = args.platform ?? "google";
  const targets = [args.domain, ...(args.competitors ?? [])];

  // Multi-target in one call, per the confirmed API description — no
  // client-side N-way aggregation needed here (unlike the pairwise
  // seo/backlinks domain_intersection tools).
  const results = (await searchMentions(
    env,
    "inspect_ai_visibility",
    targets,
    platform
  )) as MentionResult[];
  const observedAt = new Date();

  const builder = envelope("ai_visibility", { domain: args.domain, competitors: args.competitors ?? [], platform });

  for (const item of results) {
    if (!item.target) continue;
    const domainId = domainEntityId(item.target);
    builder.addEntity({ id: domainId, kind: "domain", label: item.target });
    builder.addFact({
      type: "ai_visibility.brand_mentions",
      subject: [domainId],
      data: {
        domain: item.target,
        is_you: item.target === args.domain,
        mentions: item.mentions ?? null,
        share_of_voice: item.share_of_voice ?? null,
        raw: item
      },
      provenance: provenance("ai_answer", "ai_optimization.llm_mentions.search_mentions", {
        observedAt,
        confidence: 0.5
      })
    });
  }

  return builder
    .setCoverage({ returned: results.length, total: targets.length, as_of: observedAt.toISOString(), scope_note: null })
    .build();
}

export const inspectAiVisibility: ToolModule<typeof inputSchema> = {
  name: "inspect_ai_visibility",
  title: "Inspect AI visibility",
  description:
    "How a domain shows up in AI answers vs named competitors (requires a DataForSEO key). Shape unverified — see docs.",
  inputSchema,
  handler
};
