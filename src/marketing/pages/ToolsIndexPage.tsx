import { CodeWindow } from "../../design";
import { MCP_SERVER_NAME } from "../brand";
import { SITE_URL } from "../../lib/product";
import { Hero } from "../components/Hero";
import { ToolCard } from "../components/ToolCard";
import { DOMAIN_LABELS, TOOL_PAGES, type ToolPageContent } from "../content/tool-pages";
import { renderPage } from "../Layout";

const DOMAIN_DESCRIPTIONS: Record<string, string> = {
  core: "Server capability discovery, tracked website listing, and full dataset export.",
  gsc: "First-party Google Search Console performance, live URL indexing inspection, and sitemaps (confidence 1.0).",
  analytics: "First-party Google Analytics 4 traffic metrics, landing pages, and engagement rates.",
  seo: "Keyword research, organic competitor discovery, ranking coverage, and search visibility.",
  serp: "Live SERP snapshots, organic ranks, featured snippets, and search result features.",
  backlinks: "Link profile inspection, referring domains, and competitor backlink gap analysis.",
  ai_visibility: "Generative AI engine citations, mention presence, and brand visibility tracking.",
  audit: "Deliberately held back until queue-based BFS crawling is adapted for Cloudflare Workers."
};

const DOMAIN_ORDER = ["gsc", "analytics", "seo", "serp", "backlinks", "ai_visibility", "core", "audit"];

function groupByDomain(pages: ToolPageContent[]): Map<string, ToolPageContent[]> {
  const byDomain = new Map<string, ToolPageContent[]>();
  for (const page of pages) {
    const list = byDomain.get(page.entry.domain) ?? [];
    list.push(page);
    byDomain.set(page.entry.domain, list);
  }

  // Ensure GSC and first-party integrations are at the very top of documentation
  const sorted = new Map<string, ToolPageContent[]>();
  for (const domain of DOMAIN_ORDER) {
    const list = byDomain.get(domain);
    if (list && list.length > 0) {
      sorted.set(domain, list);
    }
  }
  for (const [domain, list] of byDomain.entries()) {
    if (!sorted.has(domain)) {
      sorted.set(domain, list);
    }
  }
  return sorted;
}

const MCP_CONNECT_SNIPPET = `# Claude: Settings → Connectors → Add custom connector
${SITE_URL}/mcp

# Claude Code (then run /mcp and choose Authenticate)
claude mcp add --transport http ${MCP_SERVER_NAME} ${SITE_URL}/mcp`;

function ToolsIndexPage({ byDomain }: { byDomain: Map<string, ToolPageContent[]> }) {
  const domainEntries = [...byDomain.entries()];

  return (
    <>
      <Hero
        eyebrow="Documentation & API Reference"
        heading={`All ${TOOL_PAGES.length} MCP Tools`}
        lede="Reference for every tool Vouched exposes over Model Context Protocol. Each tool returns a typed, cited fact envelope, not ungrounded text."
      />

      <section class="docs-quickstart">
        <div class="docs-quickstart-grid">
          <div>
            <p class="chapter">Connect</p>
            <h2>Instant agent setup</h2>
            <p class="muted">
              Add the URL to Claude, Claude Code, Cursor, VS Code or any MCP client and sign in with your Vouched account. No key to
              copy. Scripts can use an API key instead.
            </p>
            <div class="docs-domain-nav">
              <span class="docs-domain-nav-label">Jump to domain:</span>
              <div class="docs-domain-pills">
                {domainEntries.map(([domain, pages]) => (
                  <a href={`#${domain}`} class="docs-domain-pill">
                    {DOMAIN_LABELS[domain] ?? domain} <small>({pages.length})</small>
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div>
            <CodeWindow title="Terminal / MCP Config">{MCP_CONNECT_SNIPPET}</CodeWindow>
          </div>
        </div>
      </section>

      {domainEntries.map(([domain, pages]) => (
        <section id={domain} class="docs-domain-section">
          <div class="docs-domain-header">
            <div>
              <p class="chapter">{domain}</p>
              <h2>{DOMAIN_LABELS[domain] ?? domain}</h2>
            </div>
            {DOMAIN_DESCRIPTIONS[domain] ? (
              <p class="muted docs-domain-desc">{DOMAIN_DESCRIPTIONS[domain]}</p>
            ) : null}
          </div>
          <div class="tool-index-grid">
            {pages.map((page) => (
              <ToolCard
                href={page.path}
                domainLabel={DOMAIN_LABELS[domain] ?? domain}
                title={page.title}
                toolName={page.entry.name}
                summary={page.entry.summary}
                billing={page.entry.billing}
                factTypes={page.entry.fact_types}
                requiresConnection={page.entry.requires_connection}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function renderToolsIndex(canonicalUrl: string, cloudMode: boolean, signedIn = false): string {
  const byDomain = groupByDomain(TOOL_PAGES);
  return renderPage({
    title: `All ${TOOL_PAGES.length} tools · Vouched Documentation`,
    description: `Documentation and reference for all ${TOOL_PAGES.length} MCP tools across ${byDomain.size} domains: keyword research, backlinks, SERP, AI-visibility, URL indexing inspection, Search Console, and GA4.`,
    canonicalUrl,
    cloudMode,
    signedIn,
    children: <ToolsIndexPage byDomain={byDomain} />
  });
}
