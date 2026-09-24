import { z } from "zod";
import { getValidAccessToken } from "../../auth/google-oauth";
import { inspectUrl } from "../../clients/google/search-console";
import { getWebsiteByDomain } from "../../db/websites";
import { envelope } from "../../envelope/builder";
import { pageEntityId, propertyEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import { ConnectionRequiredError } from "../../lib/errors";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";
import { cachedGscCall } from "./shared";

/** Indexing status changes slower than click/impression counts, no need to re-check as often as get_search_performance's default. */
const CACHE_TTL_SECONDS = 60 * 60 * 4;

const inputSchema = z.object({
  domain: z.string().describe("A tracked website's primary_domain, e.g. example.com"),
  url: z.string().url().describe("The exact URL to inspect, must belong to this website")
});

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const tenantId = env.__tenantId ?? null;
  const website = await getWebsiteByDomain(env.DB, args.domain, tenantId);
  if (!website?.gsc_site_url) {
    throw new ConnectionRequiredError(
      "webmaster_console",
      `${args.domain} has no Search Console property linked yet. In the Vouched dashboard, open Websites, edit ${args.domain} and pick its Search Console property.`
    );
  }
  const siteUrl = website.gsc_site_url;

  const accessToken = await getValidAccessToken(env, "webmaster_console", tenantId);
  const { value: result, cacheHit, fetchedAt: observedAt } = await cachedGscCall(
    env,
    tenantId,
    "inspect_indexing",
    `inspect:${siteUrl}:${args.url}`,
    CACHE_TTL_SECONDS,
    () => inspectUrl(accessToken, siteUrl, args.url)
  );

  const propertyId = propertyEntityId(website.website_id);
  const pageId = pageEntityId(args.url);
  const builder = envelope("gsc", { domain: args.domain, url: args.url, inspectionResultLink: result.inspectionResultLink })
    .addEntity({ id: propertyId, kind: "property", label: website.name })
    .addEntity({ id: pageId, kind: "page", label: args.url });

  if (result.indexStatusResult) {
    const s = result.indexStatusResult;
    builder.addFact({
      type: "gsc.index_status",
      subject: [pageId, propertyId],
      data: {
        verdict: s.verdict,
        coverage_state: s.coverageState,
        robots_txt_state: s.robotsTxtState,
        indexing_state: s.indexingState,
        page_fetch_state: s.pageFetchState,
        last_crawl_time: s.lastCrawlTime,
        google_canonical: s.googleCanonical,
        user_canonical: s.userCanonical,
        crawled_as: s.crawledAs,
        sitemaps: s.sitemap,
        referring_urls: s.referringUrls
      },
      provenance: provenance("webmaster_console", "urlInspection.index.inspect", { observedAt, cacheHit })
    });
  }

  // No mobile-usability fact: Google retired that report, and the API now
  // only ever returns VERDICT_UNSPECIFIED for it.

  if (result.richResultsResult) {
    builder.addFact({
      type: "gsc.rich_results",
      subject: [pageId],
      data: { verdict: result.richResultsResult.verdict, detected_items: result.richResultsResult.detectedItems },
      provenance: provenance("webmaster_console", "urlInspection.index.inspect", { observedAt, cacheHit })
    });
  }

  return builder
    .setCoverage({ returned: 1, total: 1, as_of: observedAt.toISOString(), scope_note: null })
    .build();
}

export const inspectIndexing: ToolModule<typeof inputSchema> = {
  name: "inspect_indexing",
  title: "Inspect indexing",
  description: "Google's own indexing status for one URL: indexed?, canonical Google chose, rich results, last crawl time.",
  inputSchema,
  handler
};
