import { Button, CodeWindow, Table } from "../../design";
import { GITHUB_URL } from "../github-url";
import { renderPage } from "../Layout";
import { getToolDocs } from "../content/tool-docs";
import { DOMAIN_LABELS, TOOL_PAGES, type ToolPageContent } from "../content/tool-pages";

function billingNote(billing: ToolPageContent["entry"]["billing"]): string {
  return billing === "free"
    ? "Free: part of the zero-paid-vendor free tier. No DataForSEO account or API key needed."
    : "Part of the DataForSEO-backed tier. Self-host with your own DataForSEO API key (billed by DataForSEO directly, zero markup), or use it bundled on a hosted cloud plan.";
}

function sourceConfidence(source: string): string {
  switch (source) {
    case "webmaster_console":
      return "First-party Google Search Console (confidence 1.0, unmodeled ground truth)";
    case "live_serp":
      return "Live SERP snapshot (confidence 0.85, real-time query observation)";
    case "search_index":
      return "Third-party search index (confidence 0.75, DataForSEO aggregated crawl)";
    case "crawl":
      return "Direct site crawl (confidence 1.0)";
    default:
      return source;
  }
}

function ToolPage({ page, cloudMode }: { page: ToolPageContent; cloudMode: boolean }) {
  const { entry, title } = page;
  const domainLabel = DOMAIN_LABELS[entry.domain] ?? entry.domain;
  const docs = getToolDocs(entry.name);

  // Sibling tools in the same domain for discovery
  const siblingTools = TOOL_PAGES.filter(
    (p) => p.entry.domain === entry.domain && p.entry.name !== entry.name
  );

  const jsonCallExample = JSON.stringify(
    {
      tool: entry.name,
      arguments: docs.exampleCall
    },
    null,
    2
  );

  return (
    <article class="tool-detail-page">
      <nav class="docs-breadcrumbs" aria-label="Breadcrumb">
        <a href="/docs">Docs</a>
        <span class="sep">/</span>
        <a href={`/docs#${entry.domain}`}>{domainLabel}</a>
        <span class="sep">/</span>
        <span class="current">{entry.name}</span>
      </nav>

      <header class="tool-header">
        <div class="tool-header-meta">
          <span class="tool-domain-tag">{domainLabel}</span>
          <span class={`tool-tier-badge ${entry.billing === "free" ? "free" : "paid"}`}>
            {entry.billing === "free" ? "Free Tier" : "DataForSEO Tier"}
          </span>
          {entry.requires_connection ? (
            <span class="tool-conn-badge">
              Requires {entry.requires_connection === "webmaster_console" ? "Search Console" : "GA4"}
            </span>
          ) : null}
          <span class="tool-status-badge">
            {entry.implemented ? "Active in MCP" : "Held Back (Roadmap)"}
          </span>
        </div>

        <h1>{title}</h1>
        <code class="tool-signature">
          {entry.name}({docs.parameters.map((p) => p.name).join(", ")})
        </code>
        <p class="tool-lede">{entry.summary}</p>
      </header>

      {/* Input Parameters Section */}
      <section class="tool-section">
        <h2>Input Parameters</h2>
        {docs.parameters.length === 0 ? (
          <p class="muted">This tool takes no arguments.</p>
        ) : (
          <Table headers={["Parameter", "Type", "Required", "Description"]}>
            {docs.parameters.map((param) => (
              <tr>
                <td>
                  <code>{param.name}</code>
                </td>
                <td>
                  <code class="type-code">{param.type}</code>
                </td>
                <td>
                  {param.required ? (
                    <span class="badge badge-required">required</span>
                  ) : (
                    <span class="badge badge-optional">optional</span>
                  )}
                </td>
                <td>{param.description}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {/* Invocation Example Section */}
      <section class="tool-section">
        <h2>MCP Invocation Example</h2>
        <p class="muted">
          Your AI agent (Claude Desktop, Cursor, or Claude Code) calls this tool using the standard Model Context Protocol schema:
        </p>
        <CodeWindow title={`${entry.name} invocation`}>{jsonCallExample}</CodeWindow>
      </section>

      {/* Output & Provenance Section */}
      <section class="tool-section">
        <h2>What it returns</h2>
        {entry.fact_types.length > 0 ? (
          <div class="fact-types-list">
            <p>Every response returns a structured Open Fact Envelope (OFE) containing typed facts:</p>
            <ul>
              {entry.fact_types.map((fact) => (
                <li>
                  <code>{fact}</code>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p class="muted">This tool is a listing or export utility; it returns structured lists or raw datasets rather than entity facts.</p>
        )}

        {entry.source_classes.length > 0 ? (
          <div class="provenance-box">
            <h3>Fact Provenance Guarantee</h3>
            <p>
              Backed by:{" "}
              {entry.source_classes.map((source, i) => (
                <span>
                  {i > 0 ? ", " : ""}
                  <strong>{sourceConfidence(source)}</strong>
                </span>
              ))}
              .
            </p>
            <p class="muted">
              Unlike generic SEO proxies, every fact emitted by Vouched includes <code>source_class</code>, <code>method</code>,{" "}
              <code>observed_at</code> timestamp, and a published <code>confidence</code> score so your AI agent knows exactly how
              much to trust the data.
            </p>
          </div>
        ) : null}
      </section>

      {/* Billing & Quota Details */}
      <section class="tool-section">
        <h2>Pricing &amp; Quota</h2>
        <p>{billingNote(entry.billing)}</p>
        {entry.requires_connection ? (
          <p>
            Requires connecting your own Google {entry.requires_connection === "webmaster_console" ? "Search Console" : "Analytics"}{" "}
            property first; this is your own first-party data, not a modeled estimate.
          </p>
        ) : null}
      </section>

      {/* Sibling Tools in Domain */}
      {siblingTools.length > 0 ? (
        <section class="tool-section">
          <h2>More {domainLabel} Tools</h2>
          <div class="sibling-tools-grid">
            {siblingTools.map((sibling) => (
              <a href={sibling.path} class="sibling-tool-card">
                <span class="sibling-name">{sibling.title}</span>
                <code class="sibling-code">{sibling.entry.name}</code>
                <p class="sibling-summary">{sibling.entry.summary}</p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section class="cta-row tool-cta-row">
        <Button href={GITHUB_URL} variant="primary">
          Self-host on GitHub (MIT)
        </Button>
        {cloudMode ? <Button href="/dashboard">Try on Cloud plan</Button> : <Button href="/pricing">See all plans</Button>}
      </section>

      <footer class="tool-footer-nav">
        <a href="/docs">← All {TOOL_PAGES.length} MCP tools reference</a>
      </footer>
    </article>
  );
}

export function renderToolPage(page: ToolPageContent, canonicalUrl: string, cloudMode: boolean): string {
  return renderPage({
    title: `${page.title} (${page.entry.name}) · Vouched Tool Documentation`,
    description: page.metaDescription,
    canonicalUrl,
    cloudMode,
    children: <ToolPage page={page} cloudMode={cloudMode} />
  });
}
