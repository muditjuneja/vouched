import type { CrawlResult } from "./crawl";

export interface IssueCluster {
  type: string;
  count: number;
  /** Up to a handful of example page URLs, not every occurrence. */
  example_pages: string[];
}

const MAX_EXAMPLES = 5;

/** Rolls up repeated per-page issues into one cluster per issue type. */
export function clusterIssues(crawl: CrawlResult): IssueCluster[] {
  const byType = new Map<string, IssueCluster>();

  for (const page of crawl.pages) {
    for (const issue of page.issues) {
      let cluster = byType.get(issue.type);
      if (!cluster) {
        cluster = { type: issue.type, count: 0, example_pages: [] };
        byType.set(issue.type, cluster);
      }
      cluster.count++;
      if (cluster.example_pages.length < MAX_EXAMPLES) {
        cluster.example_pages.push(page.url);
      }
    }
  }

  return [...byType.values()].sort((a, b) => b.count - a.count);
}

/**
 * A simple, transparent heuristic (not a certified metric): start at 100,
 * lose a point per issue relative to pages scanned, floor at 0.
 */
export function computeSiteHealthScore(crawl: CrawlResult): number {
  if (crawl.pages.length === 0) return 0;
  const totalIssues = crawl.pages.reduce((sum, p) => sum + p.issues.length, 0);
  const issuesPerPage = totalIssues / crawl.pages.length;
  return Math.max(0, Math.round(100 - issuesPerPage * 15));
}
