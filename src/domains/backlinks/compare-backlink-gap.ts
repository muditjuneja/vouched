import { z } from "zod";
import { backlinksDomainIntersection } from "../../clients/dataforseo/endpoints/backlinks";
import { envelope } from "../../envelope/builder";
import { brandOf, domainEntityId } from "../../envelope/entities";
import type { Entity } from "../../envelope/types";
import { storeDataset, type FactDataset } from "../../resources/store";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const SPAM_SCORE_THRESHOLD = 30;

const inputSchema = z.object({
  domain: z.string().describe("Your domain"),
  competitors: z.array(z.string()).min(1).max(5).describe("Competitor domains to find link gaps against"),
  limit: z.number().int().min(1).max(100).optional().describe("Linking sites to list per competitor (default 25); the rest come as an export")
});

const FETCH_PER_COMPETITOR = 100;

/** One referring domain's links to the competitor (`domain_intersection["1"]`; `target` is the referring domain). */
interface LinkingDomain {
  target?: string;
  rank?: number;
  backlinks?: number;
  backlinks_spam_score?: number;
  first_seen?: string;
}
interface IntersectionItem {
  domain_intersection?: Record<string, LinkingDomain | undefined>;
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const limit = args.limit ?? 25;
  const observedAt = new Date();
  const domainId = domainEntityId(args.domain);
  const yourBrand = brandOf(args.domain);
  const builder = envelope("backlinks", { domain: args.domain, competitors: args.competitors }).addEntity({
    id: domainId,
    kind: "domain",
    label: args.domain
  });

  // One call per competitor: sites linking to that competitor, excluding
  // any that already link to the domain.
  const perCompetitor = await Promise.all(
    args.competitors.map((competitor) =>
      backlinksDomainIntersection(env, "compare_backlink_gap", competitor, args.domain, FETCH_PER_COMPETITOR).then((items) => ({
        competitor,
        items: items as IntersectionItem[]
      }))
    )
  );

  const entities = new Map<string, Entity>([[domainId, { id: domainId, kind: "domain", label: args.domain }]]);
  const exportItems: FactDataset["items"] = [];
  let inline = 0;
  let spamFiltered = 0;
  let ownSitesDropped = 0;
  let capped = false;

  for (const { competitor, items } of perCompetitor) {
    const competitorId = domainEntityId(competitor);
    const competitorBrand = brandOf(competitor);
    builder.addEntity({ id: competitorId, kind: "domain", label: competitor });
    entities.set(competitorId, { id: competitorId, kind: "domain", label: competitor });
    if (items.length >= FETCH_PER_COMPETITOR) capped = true;

    // Strongest linking sites first.
    const links = items
      .map((item) => item.domain_intersection?.["1"])
      .filter((link): link is LinkingDomain => Boolean(link?.target))
      .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

    let listed = 0;
    for (const link of links) {
      const referring = link.target!;
      if (link.backlinks_spam_score !== undefined && link.backlinks_spam_score > SPAM_SCORE_THRESHOLD) {
        spamFiltered++;
        continue;
      }
      // The competitor's own sites (resend-status.com) and yours aren't links you can earn.
      const host = referring.toLowerCase();
      if ((competitorBrand.length >= 3 && host.includes(competitorBrand)) || (yourBrand.length >= 3 && host.includes(yourBrand))) {
        ownSitesDropped++;
        continue;
      }
      const referringId = domainEntityId(referring);
      const entity: Entity = { id: referringId, kind: "domain", label: referring };
      const subject = [domainId, competitorId, referringId];
      const data = {
        referring_domain: referring,
        referring_domain_rank: link.rank ?? null,
        backlinks_to_competitor: link.backlinks ?? null,
        spam_score: link.backlinks_spam_score ?? null,
        first_seen: link.first_seen ?? null,
        competitor_domain: competitor
      };
      exportItems.push({ subject, data });
      entities.set(referringId, entity);
      if (listed < limit) {
        listed++;
        inline++;
        builder.addEntity(entity);
        builder.addFact({ type: "backlinks.link_gap", subject, data, provenance: provenance("backlink_index", "link_gap", { observedAt }) });
      }
    }
  }

  if (exportItems.length > inline) {
    const dataset: FactDataset = {
      version: 2,
      fact_type: "backlinks.link_gap",
      source_class: "backlink_index",
      method: "link_gap",
      observed_at: observedAt.toISOString(),
      capped,
      row_limit: FETCH_PER_COMPETITOR,
      entities: [...entities.values()],
      items: exportItems
    };
    const uri = await storeDataset(env.DATASETS, "backlinks", "compare_backlink_gap", dataset, env.__tenantId ?? null);
    builder.addResource({ uri, description: `All ${exportItems.length} linking sites, beyond the ${limit} per competitor listed here.` });
  }

  const notes = [`sites linking to each competitor but not to ${args.domain}, strongest first`];
  if (spamFiltered > 0) notes.push(`${spamFiltered} left out above spam score ${SPAM_SCORE_THRESHOLD}`);
  if (ownSitesDropped > 0) notes.push(`${ownSitesDropped} of the companies' own sites left out`);
  if (exportItems.length > inline) notes.push(`${exportItems.length - inline} more in export_dataset`);
  return builder
    .setCoverage({ returned: inline, total: capped ? null : exportItems.length, as_of: observedAt.toISOString(), scope_note: notes.join("; ") })
    .build();
}

export const compareBacklinkGap: ToolModule<typeof inputSchema> = {
  name: "compare_backlink_gap",
  title: "Compare backlink gap",
  description: "Link gap: sites linking to the competitors but not to the domain, ranked by authority with spam filtered out. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
