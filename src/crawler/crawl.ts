import type { CheerioAPI } from "cheerio";
import { checkHeadings } from "./checks/headings";
import { checkImages } from "./checks/images";
import { checkIndexability } from "./checks/indexability";
import { checkLinks } from "./checks/links";
import { checkMeta } from "./checks/meta";
import type { PageIssue } from "./checks/types";
import { fetchPage } from "./fetch-page";
import { fetchRobotsRules } from "./robots";

export interface PageCrawlResult {
  url: string;
  status: number;
  issues: PageIssue[];
  internalLinkCount: number;
  externalLinkCount: number;
  imageCount: number;
}

export interface CrawlResult {
  startUrl: string;
  maxPages: number;
  pages: PageCrawlResult[];
  /** True if the crawl stopped because it hit maxPages, not because it ran out of links. */
  truncated: boolean;
}

function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  u.search = "";
  if (u.pathname !== "/" && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

function extractLinks(
  $: CheerioAPI,
  origin: string,
  pageUrl: string
): { internalLinks: string[]; externalLinkCount: number } {
  const internal = new Set<string>();
  let externalCount = 0;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#")) return;
    if (/^(mailto|tel|javascript):/i.test(href)) return;

    let resolved: URL;
    try {
      resolved = new URL(href, pageUrl);
    } catch {
      return;
    }

    if (resolved.origin === origin) {
      internal.add(normalizeUrl(resolved.toString()));
    } else {
      externalCount++;
    }
  });

  return { internalLinks: [...internal], externalLinkCount: externalCount };
}

/**
 * A bounded, robots.txt-aware BFS crawl of one site, run entirely within a
 * single Worker invocation. `maxPages` (default kept modest by the caller)
 * is what keeps this inside Workers Paid-plan subrequest/CPU limits — see
 * docs/ARCHITECTURE.md. Queue-based multi-invocation crawling for larger
 * sites is a documented future upgrade (M9), not built here.
 */
export async function crawlSite(startUrl: string, maxPages: number): Promise<CrawlResult> {
  const start = normalizeUrl(startUrl);
  const origin = new URL(start).origin;
  const robots = await fetchRobotsRules(origin);

  const visited = new Set<string>();
  const queued = new Set<string>([start]);
  const queue: string[] = [start];
  const results: PageCrawlResult[] = [];
  const statusByUrl = new Map<string, number>();
  const linksByPage = new Map<string, string[]>();

  while (queue.length > 0 && visited.size < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    if (!robots.isAllowed(new URL(url).pathname)) continue;

    const page = await fetchPage(url);
    statusByUrl.set(url, page.status);

    if (!page.$) {
      results.push({
        url,
        status: page.status,
        issues: [{ type: "non_ok_status", detail: `HTTP ${page.status || "0 (fetch failed)"}` }],
        internalLinkCount: 0,
        externalLinkCount: 0,
        imageCount: 0
      });
      continue;
    }

    const $ = page.$;
    const issues: PageIssue[] = [
      ...checkMeta($),
      ...checkHeadings($),
      ...checkImages($),
      ...checkIndexability($, page.status)
    ];

    const { internalLinks, externalLinkCount } = extractLinks($, origin, url);
    linksByPage.set(url, internalLinks);

    for (const link of internalLinks) {
      if (!visited.has(link) && !queued.has(link) && queued.size < maxPages) {
        queued.add(link);
        queue.push(link);
      }
    }

    results.push({
      url,
      status: page.status,
      issues,
      internalLinkCount: internalLinks.length,
      externalLinkCount,
      imageCount: $("img").length
    });
  }

  // Second pass: now that every crawled page's status is known, flag
  // internal links that point at a page we confirmed is broken.
  for (const result of results) {
    const outgoing = linksByPage.get(result.url) ?? [];
    result.issues.push(...checkLinks(outgoing, statusByUrl));
  }

  return {
    startUrl: start,
    maxPages,
    pages: results,
    truncated: queue.length > 0
  };
}
