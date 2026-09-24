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
  search_intent_info?: { main_intent?: string };
}

/** Words too common to show two keywords are about the same thing. */
const STOPWORDS = new Set(["the", "and", "for", "with", "how", "what", "best", "top", "free", "online", "near", "from", "your", "you", "are", "can", "does"]);

/** Meaningful words, lowercased, with a trailing plural "s" dropped (emails -> email). */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word));
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const limit = args.limit ?? 50;
  // Keyword ideas expand to the whole category, so a narrow seed drifts
  // ("transactional email api" -> "yahoo mail"). Fetch extra, keep the
  // ideas sharing a meaningful word with a seed, highest volume first.
  const results = (await keywordIdeas(
    env,
    "research_keywords",
    args.seedKeywords,
    Math.min(200, limit * 3)
  )) as KeywordIdeaResult[];
  const seedWords = new Set(args.seedKeywords.flatMap(words));
  const related = results.filter((item) => item.keyword && words(item.keyword).some((word) => seedWords.has(word)));
  const kept = related.slice(0, limit);

  const observedAt = new Date();
  const builder = envelope("seo", { seed_keywords: args.seedKeywords });

  for (const item of kept) {
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
        search_intent: item.search_intent_info?.main_intent ?? null
      },
      provenance: provenance("search_index", "keyword_ideas", { observedAt })
    });
  }

  const dropped = results.length - related.length;
  return builder
    .setCoverage({
      returned: kept.length,
      total: null,
      as_of: observedAt.toISOString(),
      scope_note: `ideas sharing a word with your seeds, highest search volume first${dropped > 0 ? `; ${dropped} broader ideas left out` : ""}`
    })
    .build();
}

export const researchKeywords: ToolModule<typeof inputSchema> = {
  name: "research_keywords",
  title: "Research keywords",
  description: "Expand seed keywords into related keyword ideas with search volume, difficulty and CPC, to decide what to target. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
