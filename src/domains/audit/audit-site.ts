import { z } from "zod";
import { crawlSite } from "../../crawler/crawl";
import { clusterIssues, computeSiteHealthScore } from "../../crawler/issue-clusters";
import { envelope } from "../../envelope/builder";
import { domainEntityId, pageEntityId } from "../../envelope/entities";
import { provenance } from "../../envelope/provenance";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  url: z.string().url().describe("The site to audit, e.g. https://example.com"),
  maxPages: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe("Page cap for this crawl (default 50); keeps one call inside a single Worker invocation")
});

async function handler(args: z.infer<typeof inputSchema>) {
  const maxPages = args.maxPages ?? 50;
  const crawl = await crawlSite(args.url, maxPages);
  const domainId = domainEntityId(args.url);
  const observedAt = new Date();

  const builder = envelope("audit", {
    url: crawl.startUrl,
    pages_scanned: crawl.pages.length,
    max_pages: maxPages,
    truncated: crawl.truncated
  }).addEntity({ id: domainId, kind: "domain", label: new URL(crawl.startUrl).hostname });

  const healthScore = computeSiteHealthScore(crawl);
  builder.addFact({
    type: "audit.site_health",
    subject: [domainId],
    data: {
      score: healthScore,
      pages_scanned: crawl.pages.length,
      total_issues: crawl.pages.reduce((sum, p) => sum + p.issues.length, 0)
    },
    provenance: provenance("crawl", "self_crawl.site_health", { observedAt })
  });

  for (const cluster of clusterIssues(crawl)) {
    builder.addFact({
      type: "audit.issue_cluster",
      subject: [domainId],
      data: { ...cluster },
      provenance: provenance("crawl", "self_crawl.issue_cluster", { observedAt })
    });
  }

  for (const page of crawl.pages) {
    const pageId = pageEntityId(page.url);
    builder.addEntity({ id: pageId, kind: "page", label: page.url, attrs: { status: page.status } });
    for (const issue of page.issues) {
      builder.addFact({
        type: "audit.crawl_issue",
        subject: [pageId],
        data: { issue_type: issue.type, detail: issue.detail, page_url: page.url },
        provenance: provenance("crawl", "self_crawl.page_check", { observedAt })
      });
    }
  }

  return builder
    .setCoverage({
      returned: crawl.pages.length,
      total: crawl.truncated ? null : crawl.pages.length,
      as_of: observedAt.toISOString(),
      scope_note: crawl.truncated
        ? `stopped at the ${maxPages}-page cap; the site may have more pages`
        : "crawl exhausted all discoverable internal links"
    })
    .build();
}

export const auditSite: ToolModule<typeof inputSchema> = {
  name: "audit_site",
  title: "Audit site",
  description: "Fast technical and content health audit of your own site: crawls it directly, no paid data.",
  inputSchema,
  handler
};
