import { z } from "zod";
import { domainIntersection } from "../../clients/dataforseo/endpoints/labs";
import { envelope } from "../../envelope/builder";
import { brandOf, domainEntityId, keywordEntityId } from "../../envelope/entities";
import type { Entity } from "../../envelope/types";
import { storeDataset, type FactDataset } from "../../resources/store";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  domain: z.string().describe("Your domain"),
  competitors: z.array(z.string()).min(1).max(5).describe("Competitor domains to find keyword gaps against"),
  limit: z.number().int().min(1).max(100).optional().describe("Keywords to list per competitor (default 25); the rest come as an export")
});

/** Only keywords the competitor ranks for in the top 20: deeper positions bring little traffic worth chasing. */
const MAX_COMPETITOR_POSITION = 20;
const FETCH_PER_COMPETITOR = 100;

/** A keyword the competitor (target1) ranks for and the domain (target2) doesn't. */
interface GapItem {
  keyword_data?: { keyword?: string; keyword_info?: { search_volume?: number; cpc?: number }; keyword_properties?: { keyword_difficulty?: number } };
  first_domain_serp_element?: { rank_group?: number; url?: string; etv?: number } | null;
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const limit = args.limit ?? 25;
  const observedAt = new Date();
  const domainId = domainEntityId(args.domain);
  const builder = envelope("seo", { domain: args.domain, competitors: args.competitors }).addEntity({
    id: domainId,
    kind: "domain",
    label: args.domain
  });

  // One call per competitor (the endpoint compares two domains):
  // competitor first, so the rows are keywords it ranks for and the domain
  // doesn't, top 20 positions only, highest search volume first.
  const perCompetitor = await Promise.all(
    args.competitors.map((competitor) =>
      domainIntersection(env, "compare_keyword_coverage", competitor, args.domain, FETCH_PER_COMPETITOR, {
        maxTarget1Position: MAX_COMPETITOR_POSITION
      }).then((items) => ({ competitor, items: items as GapItem[] }))
    )
  );

  const entities = new Map<string, Entity>([[domainId, { id: domainId, kind: "domain", label: args.domain }]]);
  const exportItems: FactDataset["items"] = [];
  let inline = 0;
  let brandDropped = 0;
  let capped = false;

  for (const { competitor, items } of perCompetitor) {
    const competitorId = domainEntityId(competitor);
    const brand = brandOf(competitor);
    builder.addEntity({ id: competitorId, kind: "domain", label: competitor });
    entities.set(competitorId, { id: competitorId, kind: "domain", label: competitor });
    if (items.length >= FETCH_PER_COMPETITOR) capped = true;

    let listed = 0;
    for (const item of items) {
      const keyword = item.keyword_data?.keyword;
      if (!keyword) continue;
      // Searches for the competitor's own brand ("resend login") aren't a gap you can close.
      if (brand.length >= 3 && keyword.toLowerCase().includes(brand)) {
        brandDropped++;
        continue;
      }
      const keywordId = keywordEntityId(keyword);
      const entity: Entity = { id: keywordId, kind: "keyword", label: keyword };
      const subject = [domainId, competitorId, keywordId];
      const data = {
        keyword,
        search_volume: item.keyword_data?.keyword_info?.search_volume ?? null,
        keyword_difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty ?? null,
        competitor_domain: competitor,
        competitor_position: item.first_domain_serp_element?.rank_group ?? null,
        competitor_url: item.first_domain_serp_element?.url ?? null
      };
      exportItems.push({ subject, data });
      entities.set(keywordId, entity);
      if (listed < limit) {
        listed++;
        inline++;
        builder.addEntity(entity);
        builder.addFact({ type: "seo.keyword_opportunity", subject, data, provenance: provenance("search_index", "keyword_gap", { observedAt }) });
      }
    }
  }

  if (exportItems.length > inline) {
    const dataset: FactDataset = {
      version: 2,
      fact_type: "seo.keyword_opportunity",
      source_class: "search_index",
      method: "keyword_gap",
      observed_at: observedAt.toISOString(),
      capped,
      row_limit: FETCH_PER_COMPETITOR,
      entities: [...entities.values()],
      items: exportItems
    };
    const uri = await storeDataset(env.DATASETS, "seo", "compare_keyword_coverage", dataset);
    builder.addResource({ uri, description: `All ${exportItems.length} gap keywords, beyond the ${limit} per competitor listed here.` });
  }

  const notes = [`keywords each competitor ranks for in the top ${MAX_COMPETITOR_POSITION} and ${args.domain} doesn't, highest search volume first`];
  if (brandDropped > 0) notes.push(`${brandDropped} searches for a competitor's own brand left out`);
  if (exportItems.length > inline) notes.push(`${exportItems.length - inline} more in export_dataset`);
  return builder
    .setCoverage({ returned: inline, total: capped ? null : exportItems.length, as_of: observedAt.toISOString(), scope_note: notes.join("; ") })
    .build();
}

export const compareKeywordCoverage: ToolModule<typeof inputSchema> = {
  name: "compare_keyword_coverage",
  title: "Compare keyword coverage",
  description: "Keyword gap: keywords the competitors rank for that the domain doesn't, with volumes. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
