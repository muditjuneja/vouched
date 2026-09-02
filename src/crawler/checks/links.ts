import type { PageIssue } from "./types";

/**
 * Flags outgoing internal links that point to a page this crawl actually
 * fetched and got a non-2xx status for. Links to pages outside the crawl's
 * page cap are left unchecked (unknown, not "broken") rather than guessed at.
 */
export function checkLinks(
  outgoingInternalLinks: string[],
  statusByUrl: ReadonlyMap<string, number>
): PageIssue[] {
  const issues: PageIssue[] = [];
  for (const link of outgoingInternalLinks) {
    const status = statusByUrl.get(link);
    if (status !== undefined && (status < 200 || status >= 300)) {
      issues.push({ type: "broken_internal_link", detail: `${link} -> HTTP ${status}` });
    }
  }
  return issues;
}
