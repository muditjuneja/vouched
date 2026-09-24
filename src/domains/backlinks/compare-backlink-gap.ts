import { z } from "zod";
import { backlinksDomainIntersection } from "../../clients/dataforseo/endpoints/backlinks";
import { envelope } from "../../envelope/builder";
import { domainEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const SPAM_SCORE_THRESHOLD = 30;

const inputSchema = z.object({
  domain: z.string().describe("Your domain"),
  competitors: z.array(z.string()).min(1).max(5).describe("Competitor domains to find link gaps against")
});

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
  const observedAt = new Date();
  const domainId = domainEntityId(args.domain);
  const builder = envelope("backlinks", { domain: args.domain, competitors: args.competitors }).addEntity({
    id: domainId,
    kind: "domain",
    label: args.domain
  });

  let returned = 0;
  let spamFiltered = 0;

  // One call per competitor: sites linking to that competitor, excluding
  // any that already link to the domain.
  const perCompetitor = await Promise.all(
    args.competitors.map((competitor) =>
      backlinksDomainIntersection(env, "compare_backlink_gap", competitor, args.domain, 100).then((items) => ({
        competitor,
        items: items as IntersectionItem[]
      }))
    )
  );

  for (const { competitor, items } of perCompetitor) {
    const competitorId = domainEntityId(competitor);
    builder.addEntity({ id: competitorId, kind: "domain", label: competitor });

    for (const item of items) {
      const link = item.domain_intersection?.["1"];
      if (!link?.target) continue;
      if (link.backlinks_spam_score !== undefined && link.backlinks_spam_score > SPAM_SCORE_THRESHOLD) {
        spamFiltered++;
        continue;
      }
      returned++;
      const referringId = domainEntityId(link.target);
      builder.addEntity({ id: referringId, kind: "domain", label: link.target });
      builder.addFact({
        type: "backlinks.link_gap",
        subject: [domainId, competitorId, referringId],
        data: {
          referring_domain: link.target,
          referring_domain_rank: link.rank ?? null,
          backlinks_to_competitor: link.backlinks ?? null,
          spam_score: link.backlinks_spam_score ?? null,
          first_seen: link.first_seen ?? null,
          competitor_domain: competitor
        },
        provenance: provenance("backlink_index", "backlinks.domain_intersection", { observedAt })
      });
    }
  }

  return builder
    .setCoverage({
      returned,
      total: null,
      as_of: observedAt.toISOString(),
      scope_note: `sites linking to each competitor but not to ${args.domain}, up to 100 per competitor${
        spamFiltered > 0 ? `; ${spamFiltered} excluded above spam score ${SPAM_SCORE_THRESHOLD}` : ""
      }`
    })
    .build();
}

export const compareBacklinkGap: ToolModule<typeof inputSchema> = {
  name: "compare_backlink_gap",
  title: "Compare backlink gap",
  description: "Link gap: sites linking to the competitors but not to the domain, ranked by authority with spam filtered out. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
