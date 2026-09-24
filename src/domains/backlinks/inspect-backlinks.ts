import { z } from "zod";
import {
  anchors as fetchAnchors,
  backlinksList,
  backlinksSummary,
  referringDomains as fetchReferringDomains
} from "../../clients/dataforseo/endpoints/backlinks";
import { envelope } from "../../envelope/builder";
import { domainEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const VIEWS = ["authority", "referring_domains", "anchors", "backlinks"] as const;

const inputSchema = z.object({
  domain: z.string(),
  view: z.enum(VIEWS).optional().describe("Which slice to fetch (default authority); one view per call"),
  limit: z.number().int().min(1).max(500).optional()
});

interface SummaryResult {
  rank?: number;
  backlinks?: number;
  referring_domains?: number;
  referring_main_domains?: number;
}
interface ReferringDomainResult {
  domain?: string;
  backlinks?: number;
  rank?: number;
}
interface AnchorResult {
  anchor?: string;
  backlinks?: number;
  referring_domains?: number;
}
interface BacklinkResult {
  domain_from?: string;
  url_from?: string;
  url_to?: string;
  anchor?: string;
  dofollow?: boolean;
  first_seen?: string;
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const view = args.view ?? "authority";
  const limit = args.limit ?? 50;
  const observedAt = new Date();
  const domainId = domainEntityId(args.domain);
  const builder = envelope("backlinks", { domain: args.domain, view }).addEntity({
    id: domainId,
    kind: "domain",
    label: args.domain
  });

  let returned = 0;

  if (view === "authority") {
    const results = (await backlinksSummary(env, "inspect_backlinks", args.domain)) as SummaryResult[];
    const summary = results[0];
    returned = summary ? 1 : 0;
    if (summary) {
      builder.addFact({
        type: "backlinks.domain_authority",
        subject: [domainId],
        data: {
          rank: summary.rank ?? null,
          total_backlinks: summary.backlinks ?? null,
          referring_domains: summary.referring_domains ?? null,
          referring_main_domains: summary.referring_main_domains ?? null
        },
        provenance: provenance("backlink_index", "backlink_summary", { observedAt })
      });
    }
  } else if (view === "referring_domains") {
    const results = (await fetchReferringDomains(
      env,
      "inspect_backlinks",
      args.domain,
      limit
    )) as ReferringDomainResult[];
    returned = results.length;
    for (const item of results) {
      if (!item.domain) continue;
      const referringId = domainEntityId(item.domain);
      builder.addEntity({ id: referringId, kind: "domain", label: item.domain });
      builder.addFact({
        type: "backlinks.referring_domain",
        subject: [domainId, referringId],
        data: { referring_domain: item.domain, backlinks: item.backlinks ?? null, rank: item.rank ?? null },
        provenance: provenance("backlink_index", "referring_domains", { observedAt })
      });
    }
  } else if (view === "anchors") {
    const results = (await fetchAnchors(env, "inspect_backlinks", args.domain, limit)) as AnchorResult[];
    returned = results.length;
    for (const item of results) {
      if (!item.anchor) continue;
      builder.addFact({
        type: "backlinks.anchor",
        subject: [domainId],
        data: {
          anchor: item.anchor,
          backlinks: item.backlinks ?? null,
          referring_domains: item.referring_domains ?? null
        },
        provenance: provenance("backlink_index", "anchor_texts", { observedAt })
      });
    }
  } else {
    const results = (await backlinksList(env, "inspect_backlinks", args.domain, limit)) as BacklinkResult[];
    returned = results.length;
    for (const item of results) {
      if (!item.url_from) continue;
      builder.addFact({
        type: "backlinks.backlink",
        subject: [domainId],
        data: {
          url_from: item.url_from,
          domain_from: item.domain_from ?? null,
          url_to: item.url_to ?? null,
          anchor: item.anchor ?? null,
          dofollow: item.dofollow ?? null,
          first_seen: item.first_seen ?? null
        },
        provenance: provenance("backlink_index", "backlink_list", { observedAt })
      });
    }
  }

  return builder
    .setCoverage({ returned, total: null, as_of: observedAt.toISOString(), scope_note: view === "authority" ? "view=authority" : `view=${view}, limit=${limit}` })
    .build();
}

export const inspectBacklinks: ToolModule<typeof inputSchema> = {
  name: "inspect_backlinks",
  title: "Inspect backlinks",
  description: "A domain's backlink profile, one view per call: authority, referring domains, anchor text, or individual backlinks. Paid market data (Pro and Team plans).",
  inputSchema,
  handler
};
