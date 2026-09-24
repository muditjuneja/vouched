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

interface DomainLinkInfo {
  backlinks?: number;
  dofollow?: number;
}
interface IntersectionResult {
  domain?: string;
  rank?: number;
  spam_score?: number;
  first_domain_backlinks_info?: DomainLinkInfo | null;
  second_domain_backlinks_info?: DomainLinkInfo | null;
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

  // One domain_intersection call per competitor, same pairwise limitation
  // as compare_keyword_coverage (see that tool's comment).
  const perCompetitor = await Promise.all(
    args.competitors.map((competitor) =>
      backlinksDomainIntersection(env, "compare_backlink_gap", args.domain, competitor, 100).then(
        (results) => ({ competitor, results: results as IntersectionResult[] })
      )
    )
  );

  for (const { competitor, results } of perCompetitor) {
    const competitorId = domainEntityId(competitor);
    builder.addEntity({ id: competitorId, kind: "domain", label: competitor });

    for (const item of results) {
      if (!item.domain) continue;
      if (item.spam_score !== undefined && item.spam_score > SPAM_SCORE_THRESHOLD) {
        spamFiltered++;
        continue;
      }

      const weHaveLink = item.first_domain_backlinks_info != null;
      const theyHaveLink = item.second_domain_backlinks_info != null;
      if (weHaveLink && theyHaveLink) continue; // not a gap either direction

      const linkInfo = theyHaveLink ? item.second_domain_backlinks_info : item.first_domain_backlinks_info;
      returned++;

      builder.addFact({
        type: "backlinks.link_gap",
        subject: [domainId, competitorId, domainEntityId(item.domain)],
        data: {
          referring_domain: item.domain,
          referring_domain_rank: item.rank ?? null,
          spam_score: item.spam_score ?? null,
          gap_direction: theyHaveLink ? "competitor_only" : "you_only",
          competitor_domain: competitor,
          // Heuristic, not a certified signal: any dofollow link counted
          // suggests a naturally earned link rather than a paid/UGC one.
          likely_earned: (linkInfo?.dofollow ?? 0) > 0
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
      scope_note: spamFiltered > 0 ? `${spamFiltered} referring domain(s) excluded above spam_score ${SPAM_SCORE_THRESHOLD}` : null
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
