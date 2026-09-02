import { z } from "zod";
import { keywordIdeas } from "../../clients/dataforseo/endpoints/labs";
import { envelope } from "../../envelope/builder";
import { keywordEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  seedKeywords: z.array(z.string()).min(1).max(20).describe("One or more seed terms to expand"),
  limit: z.number().int().min(1).max(200).optional()
});

interface KeywordIdeaResult {
  keyword?: string;
  keyword_info?: { search_volume?: number; cpc?: number; competition?: number };
  keyword_properties?: { keyword_difficulty?: number };
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const limit = args.limit ?? 50;
  const results = (await keywordIdeas(
    env,
    "research_keywords",
    args.seedKeywords,
    limit
  )) as KeywordIdeaResult[];

  const observedAt = new Date();
  const builder = envelope("seo", { seed_keywords: args.seedKeywords });

  for (const item of results) {
    if (!item.keyword) continue;
    const subject = keywordEntityId(item.keyword);
    builder.addEntity({ id: subject, kind: "keyword", label: item.keyword });
    builder.addFact({
      type: "seo.keyword_opportunity",
      subject: [subject],
      data: {
        keyword: item.keyword,
        search_volume: item.keyword_info?.search_volume ?? null,
        cpc: item.keyword_info?.cpc ?? null,
        competition: item.keyword_info?.competition ?? null,
        keyword_difficulty: item.keyword_properties?.keyword_difficulty ?? null,
        raw: item
      },
      provenance: provenance("search_index", "dataforseo_labs.keyword_ideas", { observedAt })
    });
  }

  return builder
    .setCoverage({ returned: results.length, total: null, as_of: observedAt.toISOString(), scope_note: null })
    .build();
}

export const researchKeywords: ToolModule<typeof inputSchema> = {
  name: "research_keywords",
  title: "Research keywords",
  description: "Expand seed terms into a ranked demand list (requires a DataForSEO key).",
  inputSchema,
  handler
};
