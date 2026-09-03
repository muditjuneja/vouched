import { Hero } from "../components/Hero";
import { ToolCard } from "../components/ToolCard";
import { DOMAIN_LABELS, TOOL_PAGES, type ToolPageContent } from "../content/tool-pages";
import { renderPage } from "../Layout";

function groupByDomain(pages: ToolPageContent[]): Map<string, ToolPageContent[]> {
  const byDomain = new Map<string, ToolPageContent[]>();
  for (const page of pages) {
    const list = byDomain.get(page.entry.domain) ?? [];
    list.push(page);
    byDomain.set(page.entry.domain, list);
  }
  return byDomain;
}

function ToolsIndexPage({ byDomain }: { byDomain: Map<string, ToolPageContent[]> }) {
  return (
    <>
      <Hero eyebrow="Tool reference" heading={`All ${TOOL_PAGES.length} MCP tools`} lede="Every tool mcp-seo-toolkit offers, grouped by domain. Each one returns a typed, cited fact envelope — not free text." />
      {[...byDomain.entries()].map(([domain, pages]) => (
        <section>
          <h2>{DOMAIN_LABELS[domain] ?? domain}</h2>
          <div class="tool-index-grid">
            {pages.map((page) => (
              <ToolCard href={page.path} domainLabel={DOMAIN_LABELS[domain] ?? domain} title={page.title} summary={page.entry.summary} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function renderToolsIndex(canonicalUrl: string): string {
  const byDomain = groupByDomain(TOOL_PAGES);
  return renderPage({
    title: `All ${TOOL_PAGES.length} tools — mcp-seo-toolkit`,
    description: `Reference for every MCP tool mcp-seo-toolkit offers across ${byDomain.size} domains: keyword research, backlinks, SERP, AI-visibility, technical audits, Search Console, and GA4.`,
    canonicalUrl,
    children: <ToolsIndexPage byDomain={byDomain} />
  });
}
