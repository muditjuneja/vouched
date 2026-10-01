import { z } from "zod";
import { keywordIdeas, keywordSuggestions } from "../../clients/dataforseo/endpoints/labs";
import { envelope } from "../../envelope/builder";
import { keywordEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  seedKeywords: z.array(z.string()).min(1).max(20).describe("One or more seed terms to expand"),
  mode: z
    .enum(["suggestions", "ideas"])
    .optional()
    .describe(
      "suggestions (default): searches containing a seed phrase, one request per seed. ideas: the wider category around the seeds in one request, including searches that share no words with them"
    ),
  limit: z.number().int().min(1).max(200).optional()
});

interface KeywordIdeaResult {
  keyword?: string;
  keyword_info?: { search_volume?: number; cpc?: number; competition?: number };
  keyword_properties?: { keyword_difficulty?: number };
  search_intent_info?: { main_intent?: string };
}

async function fetchKeywords(env: Env, seeds: string[], mode: "suggestions" | "ideas", limit: number): Promise<KeywordIdeaResult[]> {
  if (mode === "ideas") return (await keywordIdeas(env, "research_keywords", seeds, limit)) as KeywordIdeaResult[];
  const perSeed = await Promise.all(seeds.map((seed) => keywordSuggestions(env, "research_keywords", seed, limit) as Promise<KeywordIdeaResult[]>));
  // Seeds overlap ("email api", "transactional email api"): keep each keyword once.
  const byKeyword = new Map<string, KeywordIdeaResult>();
  for (const item of perSeed.flat()) {
    if (item.keyword && !byKeyword.has(item.keyword)) byKeyword.set(item.keyword, item);
  }
  return [...byKeyword.values()].sort((a, b) => (b.keyword_info?.search_volume ?? 0) - (a.keyword_info?.search_volume ?? 0));
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const limit = args.limit ?? 50;
  const mode = args.mode ?? "suggestions";
  const results = await fetchKeywords(env, args.seedKeywords, mode, limit);
  // Navigational searches are people looking for one site ("outlook email
  // login"): rarely worth targeting, so they go last. Intent is the index's
  // own label; nothing is dropped.
  const isNavigational = (item: KeywordIdeaResult) => item.search_intent_info?.main_intent === "navigational";
  const kept = [...results.filter((item) => !isNavigational(item)), ...results.filter(isNavigational)].slice(0, limit);

  const observedAt = new Date();
  const builder = envelope("seo", { seed_keywords: args.seedKeywords, mode });

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
      provenance: provenance("search_index", mode === "ideas" ? "keyword_ideas" : "keyword_suggestions", { observedAt })
    });
  }

  const navigational = kept.filter(isNavigational).length;
  const notes = [mode === "ideas" ? "the wider category around your seeds, highest search volume first" : "searches containing a seed phrase, highest search volume first"];
  if (navigational > 0) notes.push(`${navigational} navigational searches (people looking for one site) listed last`);
  return builder
    .setCoverage({
      returned: kept.length,
      total: null,
      as_of: observedAt.toISOString(),
      scope_note: notes.join("; ")
    })
    .build();
}

export const researchKeywords: ToolModule<typeof inputSchema> = {
  name: "research_keywords",
  title: "Research keywords",
  description: "Expand seed keywords into keyword ideas with search volume, difficulty, CPC and intent, to decide what to target. Suggestions mode costs one request per seed keyword. Paid market data (Pro and Team plans). A keyword_difficulty of 0 can mean the provider had too little data to score it, not that it's easy; check it against CPC and who ranks.",
  inputSchema,
  handler
};
