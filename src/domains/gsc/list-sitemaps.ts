import { z } from "zod";
import { getValidAccessToken } from "../../auth/google-oauth";
import { listSitemaps } from "../../clients/google/search-console";
import { getWebsiteByDomain } from "../../db/websites";
import { envelope } from "../../envelope/builder";
import { propertyEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import { ConnectionRequiredError } from "../../lib/errors";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";
import { cachedGscCall } from "./shared";

/** Sitemap submission/read state changes on Google's own crawl schedule, slower still than indexing status. */
const CACHE_TTL_SECONDS = 60 * 60 * 6;

const inputSchema = z.object({
  domain: z.string().describe("A tracked website's primary_domain, e.g. example.com")
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
  const { value: sitemaps, cacheHit, fetchedAt: observedAt } = await cachedGscCall(
    env,
    tenantId,
    "list_sitemaps",
    `sitemaps:${siteUrl}`,
    CACHE_TTL_SECONDS,
    () => listSitemaps(accessToken, siteUrl)
  );

  const propertyId = propertyEntityId(website.website_id);
  const builder = envelope("gsc", {
    domain: args.domain,
    sitemapCount: sitemaps.length,
    // Confirmed against a real property: Google deprecated this field
    // (John Mueller acknowledged it stopped being populated): it always
    // reports 0 regardless of actual indexing, so a 0 here means nothing.
    // Use inspect_indexing for a real per-URL indexed/not-indexed answer.
    contentsIndexedCountCaveat: "Google no longer populates each sitemap's contents[].indexed count (always 0); it's not a real signal. Use inspect_indexing for actual per-URL indexing status."
  }).addEntity({
    id: propertyId,
    kind: "property",
    label: website.name
  });

  for (const sitemap of sitemaps) {
    builder.addFact({
      type: "gsc.sitemap_status",
      subject: [propertyId],
      data: {
        path: sitemap.path,
        last_submitted: sitemap.lastSubmitted,
        last_downloaded: sitemap.lastDownloaded,
        is_sitemaps_index: sitemap.isSitemapsIndex,
        is_pending: sitemap.isPending,
        warnings: sitemap.warnings,
        errors: sitemap.errors,
        contents: sitemap.contents
      },
      provenance: provenance("webmaster_console", "sitemaps.list", { observedAt, cacheHit })
    });
  }

  return builder
    .setCoverage({
      returned: sitemaps.length,
      total: sitemaps.length,
      as_of: observedAt.toISOString(),
      scope_note: sitemaps.length === 0 ? "no sitemaps submitted for this property" : null
    })
    .build();
}

export const listSitemapsTool: ToolModule<typeof inputSchema> = {
  name: "list_sitemaps",
  title: "List sitemaps",
  description: "Submitted sitemaps for one of your tracked websites, from Search Console: last read, warnings, errors and submitted URL counts. Google's indexed count here is deprecated (always 0); use inspect_indexing for real indexing status.",
  inputSchema,
  handler
};
