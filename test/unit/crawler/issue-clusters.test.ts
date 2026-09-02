import { describe, expect, it } from "vitest";
import type { CrawlResult } from "../../../src/crawler/crawl";
import type { PageIssue } from "../../../src/crawler/checks/types";
import { clusterIssues, computeSiteHealthScore } from "../../../src/crawler/issue-clusters";

function crawlWith(pages: CrawlResult["pages"]): CrawlResult {
  return { startUrl: "https://example.com", maxPages: 50, pages, truncated: false };
}

describe("clusterIssues", () => {
  it("groups repeated issue types across pages, sorted by count desc", () => {
    const crawl = crawlWith([
      {
        url: "https://example.com/a",
        status: 200,
        issues: [
          { type: "missing_title", detail: "x" },
          { type: "missing_h1", detail: "y" }
        ],
        internalLinkCount: 0,
        externalLinkCount: 0,
        imageCount: 0
      },
      {
        url: "https://example.com/b",
        status: 200,
        issues: [{ type: "missing_title", detail: "x" }],
        internalLinkCount: 0,
        externalLinkCount: 0,
        imageCount: 0
      }
    ]);

    const clusters = clusterIssues(crawl);
    expect(clusters[0]).toMatchObject({ type: "missing_title", count: 2 });
    expect(clusters[0]!.example_pages).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(clusters[1]).toMatchObject({ type: "missing_h1", count: 1 });
  });

  it("returns an empty list for a clean crawl", () => {
    const crawl = crawlWith([
      {
        url: "https://example.com/",
        status: 200,
        issues: [],
        internalLinkCount: 0,
        externalLinkCount: 0,
        imageCount: 0
      }
    ]);
    expect(clusterIssues(crawl)).toEqual([]);
  });
});

describe("computeSiteHealthScore", () => {
  it("scores a perfectly clean crawl at 100", () => {
    const crawl = crawlWith([
      { url: "https://example.com/", status: 200, issues: [], internalLinkCount: 0, externalLinkCount: 0, imageCount: 0 }
    ]);
    expect(computeSiteHealthScore(crawl)).toBe(100);
  });

  it("docks points proportional to issues-per-page, floored at 0", () => {
    const manyIssues: PageIssue[] = Array.from({ length: 10 }, (_, i) => ({
      type: "missing_title",
      detail: `${i}`
    }));
    const crawl = crawlWith([
      { url: "https://example.com/", status: 200, issues: manyIssues, internalLinkCount: 0, externalLinkCount: 0, imageCount: 0 }
    ]);
    expect(computeSiteHealthScore(crawl)).toBe(0);
  });

  it("returns 0 for an empty crawl rather than dividing by zero", () => {
    expect(computeSiteHealthScore(crawlWith([]))).toBe(0);
  });
});
