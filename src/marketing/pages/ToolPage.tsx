import { MONTHLY_QUOTA_USD } from "../../billing/quotas";
import { TOOL_COST_ESTIMATES, callsIncludedInPro, costUnit, describeCost } from "../../billing/tool-costs";
import { Button, CodeWindow, Table } from "../../design";
import { GITHUB_URL } from "../github-url";
import { renderPage } from "../Layout";
import { getToolDocs } from "../content/tool-docs";
import { DOMAIN_LABELS, TOOL_PAGES, type ToolPageContent } from "../content/tool-pages";

function billingNote(entry: ToolPageContent["entry"]): string {
  if (entry.billing === "free") {
    return "Free on every plan: it reads your own Google data, so there's no per-call cost. Works the same when self-hosted.";
  }
  const cost = TOOL_COST_ESTIMATES[entry.name];
  const costLine = cost
    ? ` A call typically costs ${describeCost(cost)} of market data, so Pro's included $${MONTHLY_QUOTA_USD.pro} covers roughly ${callsIncludedInPro(cost)} ${costUnit(cost)}.`
    : "";
  return `Paid market data, on Pro and Team.${costLine} Self-hosted, it uses your own DataForSEO key and bills you directly, with nothing added. See pricing for what each tool costs.`;
}

function confidenceLabel(sourceClass: string, score: number): { label: string; badgeClass: string } {
  if (sourceClass === "webmaster_console" || sourceClass === "analytics_property" || score >= 1.0) {
    return { label: "First-Party Ground Truth", badgeClass: "conf-perfect" };
  }
  if (sourceClass === "live_serp") {
    return { label: "Live SERP Snapshot", badgeClass: "conf-high" };
  }
  if (sourceClass === "backlink_index") {
    return { label: "Backlink Index", badgeClass: "conf-med" };
  }
  if (sourceClass === "search_index") {
    return { label: "Search Index", badgeClass: "conf-med" };
  }
  if (sourceClass === "crawl") {
    return { label: "Direct Crawl", badgeClass: "conf-high" };
  }
  if (sourceClass === "ai_answer") {
    return { label: "Generative AI Sampling", badgeClass: "conf-low" };
  }
  return { label: "Core Metadata", badgeClass: "conf-perfect" };
}

function ToolPage({ page, cloudMode, signedIn }: { page: ToolPageContent; cloudMode: boolean; signedIn: boolean }) {
  const { entry, title } = page;
  const domainLabel = DOMAIN_LABELS[entry.domain] ?? entry.domain;
  const docs = getToolDocs(entry.name);
  const conf = confidenceLabel(docs.provenance.sourceClass, docs.provenance.confidence);

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

  const jsonResponseExample = JSON.stringify(docs.exampleResponse, null, 2);

  // Monospace parameter signature: inspect_keyword(keyword: string)
  const signatureParams = docs.parameters
    .map((p) => `${p.name}${p.required ? "" : "?"}: ${p.type}`)
    .join(", ");

  return (
    <article class="tool-detail-page">
      {/* Breadcrumb Navigation */}
      <nav class="docs-breadcrumbs" aria-label="Breadcrumb">
        <a href="/docs">Docs</a>
        <span class="sep">/</span>
        <a href={`/docs#${entry.domain}`}>{domainLabel}</a>
        <span class="sep">/</span>
        <span class="current">{entry.name}</span>
      </nav>

      {/* Tool Header */}
      <header class="tool-header">
        <div class="tool-header-meta">
          <span class="tool-domain-tag">{domainLabel}</span>
          <span class={`tool-tier-badge ${entry.billing === "free" ? "free" : "paid"}`}>
            {entry.billing === "free" ? "Free" : "Pro / BYOK"}
          </span>
          <span class={`tool-conf-badge ${conf.badgeClass}`}>{conf.label}</span>
          {entry.requires_connection ? (
            <span class="tool-conn-badge">
              Requires {entry.requires_connection === "webmaster_console" ? "Search Console OAuth" : "GA4 OAuth"}
            </span>
          ) : null}
          <span class="tool-status-badge">
            {entry.implemented ? "Active in MCP" : "Held Back (Roadmap)"}
          </span>
        </div>

        <h1>{title}</h1>
        <code class="tool-signature">
          {entry.name}({signatureParams})
        </code>
        <p class="tool-lede">{entry.summary}</p>
        <p class="tool-sub-lede">{docs.dataSummary}</p>

        {/* In-page Anchor Subnav */}
        <nav class="tool-subnav" aria-label="Page navigation">
          <a href="#parameters">Parameters ({docs.parameters.length})</a>
          <a href="#envelope">Return Envelope</a>
          {docs.emittedFacts.length > 0 ? <a href="#facts">Emitted Facts ({docs.emittedFacts.length})</a> : null}
          <a href="#examples">Request &amp; Response</a>
          <a href="#workflow">Agent Workflow</a>
          <a href="#provenance">Guarantees &amp; Errors</a>
          {siblingTools.length > 0 ? <a href="#siblings">Related Tools</a> : null}
        </nav>
      </header>

      {/* Input Parameters Section */}
      <section id="parameters" class="tool-section">
        <div class="section-title-row">
          <h2>Input Parameters</h2>
          <span class="section-badge">{docs.parameters.length} argument{docs.parameters.length === 1 ? "" : "s"}</span>
        </div>

        {docs.parameters.length === 0 ? (
          <div class="empty-params-card">
            <p>This tool takes no arguments.</p>
            <code>{"{}"}</code>
          </div>
        ) : (
          <Table headers={["Parameter", "Type", "Requirement", "Default / Constraints", "Description"]}>
            {docs.parameters.map((param) => (
              <tr>
                <td>
                  <strong class="param-name"><code>{param.name}</code></strong>
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
                <td>
                  <div class="param-meta">
                    {param.default ? <span class="param-default">default: <code>{param.default}</code></span> : null}
                    {param.constraints ? <span class="param-constraints">{param.constraints}</span> : null}
                    {!param.default && !param.constraints ? <span class="muted">none</span> : null}
                  </div>
                </td>
                <td class="param-desc">{param.description}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {/* Return Envelope Section (OFE / 1.0) */}
      <section id="envelope" class="tool-section">
        <div class="section-title-row">
          <h2>Return Envelope (OFE / 1.0)</h2>
          <span class="section-badge">Open Fact Envelope</span>
        </div>
        <p class="muted">
          Every response adheres to the strict <code>ofe/1.0</code> envelope schema, returning verified data, typed facts,
          entity references, and follow-up tool suggestions:
        </p>

        <div class="envelope-grid">
          <div class="envelope-card">
            <h3><code>data</code> Payload</h3>
            <p>{docs.dataSummary}</p>
          </div>
          <div class="envelope-card">
            <h3><code>coverage</code> &amp; Freshness</h3>
            <p>
              Reports <code>returned</code> count vs <code>total</code> items, observation timestamp <code>as_of</code>, and scope notes.
              {docs.provenance.cacheTtl ? ` Cached in KV for ${docs.provenance.cacheTtl}.` : " Evaluated live per request."}
            </p>
          </div>
          <div class="envelope-card">
            <h3><code>resources</code> (Dataset Exports)</h3>
            <p>
              If a query yields high row counts (e.g. {">"}1,000 queries in Search Console), full unpaginated tables are persisted to R2
              and linked as an <code>mcpseo://</code> URI for follow-up retrieval via <code>export_dataset</code>.
            </p>
          </div>
          <div class="envelope-card">
            <h3><code>next_actions</code></h3>
            <p>
              Provides suggested follow-up tool calls with pre-filled arguments so your AI agent can navigate from discovery to detailed inspection autonomously.
            </p>
          </div>
        </div>
      </section>

      {/* Emitted Facts & Entities Section */}
      {(docs.emittedFacts.length > 0 || docs.entitiesEmitted.length > 0) ? (
        <section id="facts" class="tool-section">
          <div class="section-title-row">
            <h2>Emitted Facts &amp; Entities</h2>
            <span class="section-badge">Knowledge Graph</span>
          </div>

          {docs.emittedFacts.length > 0 ? (
            <>
              <h3>Typed Facts</h3>
              <p class="muted">Facts emitted in the <code>facts[]</code> array with provenance receipts:</p>
              <Table headers={["Fact Type", "Claim Description", "Emitted Data Fields"]}>
                {docs.emittedFacts.map((fact) => (
                  <tr>
                    <td>
                      <code>{fact.type}</code>
                    </td>
                    <td>{fact.description}</td>
                    <td>
                      <div class="fact-fields">
                        {fact.fields.map((f) => (
                          <span class="field-pill"><code>{f}</code></span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </>
          ) : null}

          {docs.entitiesEmitted.length > 0 ? (
            <div style="margin-top: 1.5rem">
              <h3>Registered Entities</h3>
              <p class="muted">Entities registered in the <code>entities[]</code> array to establish subject relationships:</p>
              <div class="entities-grid">
                {docs.entitiesEmitted.map((ent) => (
                  <div class="entity-card">
                    <span class="entity-kind-badge">{ent.kind}</span>
                    <p>{ent.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Request & Response Code Examples */}
      <section id="code-examples" class="tool-section">
        <div class="section-title-row">
          <h2>Request &amp; Response Examples</h2>
          <span class="section-badge">Live MCP Payloads</span>
        </div>
        <p class="muted">
          Exact JSON schemas transmitted over Model Context Protocol (stdio or HTTP SSE transport):
        </p>

        <div class="code-examples-split">
          <div class="code-example-col">
            <h3>1. Client Tool Invocation</h3>
            <CodeWindow title={`${entry.name} request.json`}>{jsonCallExample}</CodeWindow>
          </div>
          <div class="code-example-col">
            <h3>2. Server Envelope Response</h3>
            <CodeWindow title={`${entry.name} response.json`}>{jsonResponseExample}</CodeWindow>
          </div>
        </div>
      </section>

      {/* LLM Agent Prompt Workflow */}
      <section id="workflow" class="tool-section">
        <div class="section-title-row">
          <h2>LLM Agent Workflow</h2>
          <span class="section-badge">Claude &amp; Cursor Integration</span>
        </div>

        <div class="agent-workflow-card">
          <div class="workflow-header">
            <span class="workflow-step-num">Step 1</span>
            <h3>Prompt Trigger</h3>
          </div>
          <blockquote class="workflow-quote">
            "{docs.agentWorkflow.triggerPrompt}"
          </blockquote>

          <div class="workflow-header" style="margin-top: 1.25rem">
            <span class="workflow-step-num">Step 2</span>
            <h3>Agent Decision &amp; Reasoning</h3>
          </div>
          <p class="workflow-reasoning">{docs.agentWorkflow.agentReasoning}</p>

          {docs.agentWorkflow.followUpTools.length > 0 ? (
            <div style="margin-top: 1.25rem">
              <div class="workflow-header">
                <span class="workflow-step-num">Step 3</span>
                <h3>Recommended Follow-up Tools</h3>
              </div>
              <div class="workflow-followup-pills">
                {docs.agentWorkflow.followUpTools.map((toolName) => (
                  <a href={`/tools/${toolName.replace(/_/g, "-")}`} class="followup-pill">
                    <code>{toolName}</code> →
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Provenance, Guarantees & Error Handling */}
      <section id="provenance" class="tool-section">
        <div class="section-title-row">
          <h2>Provenance Guarantees &amp; Error Handling</h2>
          <span class="section-badge">Reliability</span>
        </div>

        <div class="provenance-detail-card">
          <div class="provenance-meta-row">
            <div>
              <span class="muted-label">Source Class</span>
              <strong class="prov-val"><code>{docs.provenance.sourceClass}</code></strong>
            </div>
            <div>
              <span class="muted-label">Inspection Method</span>
              <strong class="prov-val"><code>{docs.provenance.method}</code></strong>
            </div>
            <div>
              <span class="muted-label">OFE Calibration Score</span>
              <strong class="prov-val">{docs.provenance.confidence.toFixed(2)} (OFE 1.0 scale)</strong>
            </div>
            <div>
              <span class="muted-label">Cache Duration</span>
              <strong class="prov-val">{docs.provenance.cacheTtl ?? "None (Live)"}</strong>
            </div>
          </div>

          <p class="provenance-desc">
            Every fact emitted by Vouched includes <code>source_class</code>, <code>method</code>, <code>observed_at</code> ISO timestamp,
            and a published <code>confidence</code> score. LLM agents can inspect these citations to distinguish first-party verified facts (e.g. Search Console) from modeled competitor estimates.
          </p>

          <div class="pricing-rules-box">
            <h3>Billing &amp; API Keys</h3>
            <p>{billingNote(entry)}</p>
            {entry.requires_connection ? (
              <p>
                <strong>Connection Required:</strong> Requires connecting your Google{" "}
                {entry.requires_connection === "webmaster_console" ? "Search Console" : "Analytics (GA4)"} property via OAuth.
                Until it's connected, calls return a <code>connection_required</code> error saying where to connect it (Settings in the dashboard).
              </p>
            ) : null}
          </div>

          {docs.errors && docs.errors.length > 0 ? (
            <div class="error-conditions-box">
              <h3>Error Conditions</h3>
              <ul>
                {docs.errors.map((err) => (
                  <li>
                    <code>{err}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      {/* Sibling Tools in Domain */}
      {siblingTools.length > 0 ? (
        <section id="siblings" class="tool-section">
          <div class="section-title-row">
            <h2>More {domainLabel} Tools</h2>
            <span class="section-badge">{siblingTools.length} sibling tools</span>
          </div>
          <div class="sibling-tools-grid">
            {siblingTools.map((sibling) => (
              <a href={sibling.path} class="sibling-tool-card">
                <div class="sibling-card-header">
                  <span class="sibling-name">{sibling.title}</span>
                  <span class={`sibling-badge ${sibling.entry.billing === "free" ? "free" : "paid"}`}>
                    {sibling.entry.billing === "free" ? "Free" : "Pro / BYOK"}
                  </span>
                </div>
                <code class="sibling-code">{sibling.entry.name}()</code>
                <p class="sibling-summary">{sibling.entry.summary}</p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* Bottom CTA Row */}
      <section class="cta-row tool-cta-row">
        <Button href={GITHUB_URL} variant="primary">
          Self-host on GitHub (MIT)
        </Button>
        {cloudMode ? <Button href="/dashboard">{signedIn ? "Open dashboard" : "Try on Cloud plan"}</Button> : <Button href="/pricing">See all plans</Button>}
      </section>

      <footer class="tool-footer-nav">
        <a href="/docs">← All {TOOL_PAGES.length} MCP tools reference</a>
      </footer>
    </article>
  );
}

export function renderToolPage(page: ToolPageContent, canonicalUrl: string, cloudMode: boolean, signedIn = false): string {
  return renderPage({
    title: `${page.title} (${page.entry.name}) · Vouched Tool Documentation`,
    description: page.metaDescription,
    canonicalUrl,
    cloudMode,
    signedIn,
    children: <ToolPage page={page} cloudMode={cloudMode} signedIn={signedIn} />
  });
}
