import { MONTHLY_QUOTA_USD } from "../billing/quotas";
import { TOOL_MANIFEST } from "../mcp/manifest";
import type { ComparisonPage } from "./content/comparisons";
import type { IndustryPage } from "./content/industries";
import { DOMAIN_LABELS, TOOL_PAGES, type ToolPageContent } from "./content/tool-pages";
import { esc, layout } from "./html";

export const GITHUB_URL = "https://github.com/muditjuneja/experiments";

const FREE_DOMAINS = new Set(["core", "audit", "gsc", "analytics"]);
const FREE_TOOL_COUNT = TOOL_MANIFEST.filter((t) => FREE_DOMAINS.has(t.domain)).length;
const DATAFORSEO_TOOL_COUNT = TOOL_MANIFEST.length - FREE_TOOL_COUNT;

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------

export function renderLanding(canonicalUrl: string): string {
  const body = `
  <section class="hero">
    <p class="eyebrow">Open source &middot; MIT licensed &middot; MCP-native</p>
    <h1>SEO and marketing data, as tools your AI agent can call directly</h1>
    <p class="lede">mcp-seo-toolkit is an open-source, self-hostable
      <a href="https://modelcontextprotocol.io">Model Context Protocol</a>
      server for SEO and marketing data — keyword research, backlinks, SERP
      snapshots, AI-visibility, technical site audits, and your own Search
      Console / GA4 — plus a hosted cloud version if you'd rather not run
      it yourself.</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="${esc(GITHUB_URL)}">Self-host it free (MIT)</a>
      <a class="btn" href="/dashboard">Use the hosted cloud version</a>
    </div>
  </section>

  <section>
    <h2>Two tiers, split honestly by what backs them</h2>
    <div class="grid">
      <div class="card">
        <h3>Free tier — zero paid vendors</h3>
        <p><code>core</code>, <code>audit</code>, <code>gsc</code>,
          <code>analytics</code> — ${esc(String(FREE_TOOL_COUNT))} tools backed
          by official Google APIs (Search Console, GA4) plus a self-crawl.
          No DataForSEO account, no API key, nothing to pay for.</p>
      </div>
      <div class="card">
        <h3>DataForSEO-backed tier — bring your own key</h3>
        <p><code>seo</code>, <code>serp</code>, <code>backlinks</code>,
          <code>ai_visibility</code> — ${esc(String(DATAFORSEO_TOOL_COUNT))} tools,
          same shapes, backed by <a href="https://dataforseo.com/">DataForSEO</a>,
          pay-as-you-go with your own API key. Self-hosted, this server never
          marks it up.</p>
      </div>
    </div>
  </section>

  <section>
    <h2>Why this exists</h2>
    <div class="grid">
      <div class="card">
        <h3>Genuinely open source</h3>
        <p>MIT licensed, the whole thing — every tool's implementation is
          readable and forkable, not a black box behind an API key.</p>
      </div>
      <div class="card">
        <h3>Zero-markup self-host</h3>
        <p>Bring your own DataForSEO key and pay DataForSEO's own
          pay-as-you-go rate directly. No credit system, no subscription
          minimum sitting between you and the underlying data cost.</p>
      </div>
      <div class="card">
        <h3>MCP-native, not dashboard-first</h3>
        <p>Every capability is a callable MCP tool with a typed, cited
          response — built for an AI agent to use in-conversation, not a
          dashboard you tab over to and copy numbers out of.</p>
      </div>
    </div>
  </section>

  <section>
    <h2>All 18 tools, across 8 domains</h2>
    <p>Every fact any tool returns carries its own provenance — source
      class, method, freshness, and a confidence score — instead of an
      unlabeled number you have to trust blind.</p>
    <ul>
      <li><strong>core</strong> — capability discovery, tracked-site
        listing, dataset export.</li>
      <li><strong>audit</strong> — a bounded, robots.txt-aware self-crawl
        with a site-health score.</li>
      <li><strong>seo</strong> — domain snapshots, competitor discovery,
        keyword research and gap analysis, search-visibility tracking.</li>
      <li><strong>serp</strong> — live SERP snapshots for a single query.</li>
      <li><strong>backlinks</strong> — link profile inspection and
        backlink-gap analysis across competitors.</li>
      <li><strong>ai_visibility</strong> — which sources AI answers cite in
        your category, and how your domain shows up in them.</li>
      <li><strong>gsc</strong> / <strong>analytics</strong> — your own
        Search Console and GA4 data, first-party, no modeling.</li>
    </ul>
    <p><a href="/tools">Browse all ${esc(String(TOOL_PAGES.length))} tools &rarr;</a></p>
  </section>

  <section>
    <h2>Pricing</h2>
    <p>Self-host is free forever. The hosted cloud version bundles
      DataForSEO access into a flat monthly plan so you don't need your own
      API key.</p>
    <p><a href="/pricing">See full pricing &rarr;</a></p>
  </section>

  <section>
    <h2>Get started</h2>
    <div class="cta-row">
      <a class="btn btn-primary" href="${esc(GITHUB_URL)}">Read the README and self-host it</a>
      <a class="btn" href="/dashboard">Sign in / start on the cloud plan</a>
    </div>
  </section>`;

  return layout({
    title: "mcp-seo-toolkit — open-source MCP server for SEO data",
    description:
      "Open-source (MIT), self-hostable MCP server for SEO and marketing data: keyword research, backlinks, SERP, AI-visibility, technical audits, and your own Search Console/GA4. Also available hosted.",
    canonicalUrl,
    bodyHtml: body
  });
}

// ---------------------------------------------------------------------------
// Pricing page
// ---------------------------------------------------------------------------

export function renderPricing(canonicalUrl: string): string {
  const body = `
  <section class="hero">
    <p class="eyebrow">Pricing</p>
    <h1>Free to self-host. Pay for convenience, not for the data.</h1>
    <p class="lede">Every plan gets the same 18 tools. What changes is who
      runs the server and who holds the DataForSEO account.</p>
  </section>

  <section class="pricing-grid">
    <div class="price-card">
      <h3>Free (self-host)</h3>
      <p class="price-amount">$0<small>/mo, forever</small></p>
      <p>Deploy your own copy to Cloudflare Workers. All 18 tools,
        including the DataForSEO-backed ones if you bring your own API
        key (billed by DataForSEO directly, zero markup).</p>
      <ul>
        <li>All ${esc(String(TOOL_MANIFEST.length))} MCP tools</li>
        <li>Free tier tools need no paid vendor at all</li>
        <li>BYOK for DataForSEO-backed tools</li>
        <li>Full source access, MIT licensed</li>
      </ul>
      <a class="btn btn-primary" href="${esc(GITHUB_URL)}">Self-host it</a>
    </div>

    <div class="price-card featured">
      <h3>Pro (cloud)</h3>
      <p class="price-amount">$${esc(String(MONTHLY_QUOTA_USD.pro))}<small>/mo, included usage</small></p>
      <p>Hosted for you. Bundled DataForSEO access — no API key to manage —
        with $${esc(String(MONTHLY_QUOTA_USD.pro))}/mo of underlying
        DataForSEO cost included before you'd need to talk to us about
        more.</p>
      <ul>
        <li>Everything in Free</li>
        <li>No DataForSEO account needed</li>
        <li>Dashboard: connection status, usage, API keys</li>
        <li>MCP API key management (create / revoke)</li>
      </ul>
      <a class="btn btn-primary" href="/dashboard">Start on Pro</a>
    </div>

    <div class="price-card">
      <h3>Team (cloud)</h3>
      <p class="price-amount">$${esc(String(MONTHLY_QUOTA_USD.team))}<small>/mo, included usage</small></p>
      <p>Same hosted product as Pro, with a larger bundled DataForSEO
        allowance — $${esc(String(MONTHLY_QUOTA_USD.team))}/mo of
        underlying cost included — for teams tracking more sites or
        running more research per month.</p>
      <ul>
        <li>Everything in Pro</li>
        <li>Higher bundled DataForSEO quota</li>
        <li>Same per-tenant dashboard and key management</li>
      </ul>
      <a class="btn" href="/dashboard">Start on Team</a>
    </div>
  </section>

  <section>
    <h2>Full comparison</h2>
    <div style="overflow-x:auto">
      <table class="compare">
        <thead>
          <tr><th>Feature</th><th>Free (self-host)</th><th>Pro (cloud)</th><th>Team (cloud)</th></tr>
        </thead>
        <tbody>
          <tr><td>Who runs the server</td><td>You</td><td>Us</td><td>Us</td></tr>
          <tr><td>All 18 MCP tools</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
          <tr><td>Free-tier tools (core/audit/gsc/analytics)</td><td>Yes, no paid vendor</td><td>Yes</td><td>Yes</td></tr>
          <tr><td>DataForSEO access</td><td>Bring your own key, billed by DataForSEO directly</td><td>Bundled, $${esc(
            String(MONTHLY_QUOTA_USD.pro)
          )}/mo included</td><td>Bundled, $${esc(String(MONTHLY_QUOTA_USD.team))}/mo included</td></tr>
          <tr><td>Dashboard (sites, usage, API keys)</td><td>&mdash; (self-managed)</td><td>Yes</td><td>Yes</td></tr>
          <tr><td>Source code</td><td colspan="3">MIT licensed for everyone, on every plan</td></tr>
        </tbody>
      </table>
    </div>
    <p class="muted">Cloud quota amounts are the deployment's current
      configured values, tuned as a starting point rather than a final,
      audited number — see <code>src/billing/quotas.ts</code> in the
      source.</p>
  </section>

  <section>
    <h2>Frequently asked</h2>
    <div class="grid">
      <div class="card">
        <h3>Do I need a DataForSEO account to self-host?</h3>
        <p>Only for the <code>seo</code>/<code>serp</code>/<code>backlinks</code>/<code>ai_visibility</code>
          tools. The free tier — audits, Search Console, GA4 — needs no
          paid vendor at all.</p>
      </div>
      <div class="card">
        <h3>Is the cloud version the same code?</h3>
        <p>Yes — same 18 tools, same open-source implementation. The cloud
          version adds hosting, bundled DataForSEO billing, and a
          dashboard on top.</p>
      </div>
      <div class="card">
        <h3>Can I switch from cloud to self-host later?</h3>
        <p>Yes — it's the same MIT-licensed codebase. Clone the repo and
          deploy your own copy whenever you want.</p>
      </div>
    </div>
  </section>`;

  return layout({
    title: "Pricing — mcp-seo-toolkit",
    description:
      "Free forever to self-host with your own DataForSEO key (zero markup), or hosted cloud plans with bundled DataForSEO access. Compare Free, Pro, and Team.",
    canonicalUrl,
    bodyHtml: body
  });
}

// ---------------------------------------------------------------------------
// Comparison pages
// ---------------------------------------------------------------------------

export function renderComparison(page: ComparisonPage, canonicalUrl: string): string {
  const rows = page.rows
    .map(
      (row) => `<tr><td>${esc(row.label)}</td><td>${esc(row.us)}</td><td>${esc(row.them)}</td></tr>`
    )
    .join("\n");

  const body = `
  <section class="hero">
    <p class="eyebrow">Comparison</p>
    <h1>${esc(page.title.replace(/ — .*/, ""))}</h1>
    <p class="lede">${esc(page.intro)}</p>
  </section>

  <section>
    <h2>Structural comparison</h2>
    <div style="overflow-x:auto">
      <table class="compare">
        <thead><tr><th></th><th>mcp-seo-toolkit</th><th>${esc(page.competitor)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="callout">${esc(page.caveat)}</p>
  </section>

  <section class="cta-row">
    <a class="btn btn-primary" href="${esc(GITHUB_URL)}">Self-host mcp-seo-toolkit</a>
    <a class="btn" href="/pricing">See pricing</a>
  </section>`;

  return layout({
    title: page.title,
    description: page.metaDescription,
    canonicalUrl,
    bodyHtml: body
  });
}

// ---------------------------------------------------------------------------
// Tools index + individual tool pages
// ---------------------------------------------------------------------------

export function renderToolsIndex(canonicalUrl: string): string {
  const byDomain = new Map<string, ToolPageContent[]>();
  for (const page of TOOL_PAGES) {
    const list = byDomain.get(page.entry.domain) ?? [];
    list.push(page);
    byDomain.set(page.entry.domain, list);
  }

  const sections = [...byDomain.entries()]
    .map(([domain, pages]) => {
      const cards = pages
        .map(
          (page) => `<a class="card" href="${esc(page.path)}">
            <p class="tool-domain">${esc(DOMAIN_LABELS[domain] ?? domain)}</p>
            <h3>${esc(page.title)}</h3>
            <p>${esc(page.entry.summary)}</p>
          </a>`
        )
        .join("\n");
      return `<section>
        <h2>${esc(DOMAIN_LABELS[domain] ?? domain)}</h2>
        <div class="tool-index-grid">${cards}</div>
      </section>`;
    })
    .join("\n");

  const body = `
  <section class="hero">
    <p class="eyebrow">Tool reference</p>
    <h1>All ${esc(String(TOOL_PAGES.length))} MCP tools</h1>
    <p class="lede">Every tool mcp-seo-toolkit offers, grouped by domain.
      Each one returns a typed, cited fact envelope — not free text.</p>
  </section>
  ${sections}`;

  return layout({
    title: `All ${TOOL_PAGES.length} tools — mcp-seo-toolkit`,
    description: `Reference for every MCP tool mcp-seo-toolkit offers across ${byDomain.size} domains: keyword research, backlinks, SERP, AI-visibility, technical audits, Search Console, and GA4.`,
    canonicalUrl,
    bodyHtml: body
  });
}

export function renderToolPage(page: ToolPageContent, canonicalUrl: string): string {
  const { entry, title } = page;

  const billingNote =
    entry.billing === "free"
      ? "Free — part of the zero-paid-vendor free tier. No DataForSEO account or API key needed."
      : "Part of the DataForSEO-backed tier. Self-host with your own DataForSEO API key (billed by DataForSEO directly, zero markup), or use it bundled on a hosted cloud plan.";

  const connectionNote = entry.requires_connection
    ? `<p>Requires connecting your own Google ${
        entry.requires_connection === "webmaster_console" ? "Search Console" : "Analytics"
      } property first — this is your own first-party data, not a modeled estimate.</p>`
    : "";

  const factList =
    entry.fact_types.length > 0
      ? `<ul>${entry.fact_types.map((f) => `<li><code>${esc(f)}</code></li>`).join("\n")}</ul>`
      : `<p class="muted">This tool doesn't emit typed facts itself — it's a capability/listing tool, not a data pull.</p>`;

  const sourceClasses = entry.source_classes.length > 0 ? entry.source_classes.map(esc).join(", ") : null;

  const body = `
  <section class="hero">
    <p class="eyebrow">${esc(DOMAIN_LABELS[entry.domain] ?? entry.domain)} tool &middot; <code>${esc(
    entry.name
  )}</code></p>
    <h1>${esc(title)}</h1>
    <p class="lede">${esc(entry.summary)}</p>
  </section>

  <section>
    <h2>What it returns</h2>
    ${factList}
    ${
      sourceClasses
        ? `<p>Backed by: <code>${sourceClasses}</code>. Every fact carries its own provenance — source class, method, freshness, and a confidence score — so you can judge how much to trust it instead of taking an unlabeled number on faith.</p>`
        : ""
    }
  </section>

  <section>
    <h2>Pricing</h2>
    <p>${billingNote}</p>
    ${connectionNote}
  </section>

  <section class="cta-row">
    <a class="btn btn-primary" href="${esc(GITHUB_URL)}">Self-host it (MIT license)</a>
    <a class="btn" href="/dashboard">Try it on the cloud plan</a>
  </section>

  <section>
    <p class="muted"><a href="/tools">&larr; All ${esc(String(TOOL_PAGES.length))} tools</a></p>
  </section>`;

  return layout({
    title: `${title} — mcp-seo-toolkit`,
    description: page.metaDescription,
    canonicalUrl,
    bodyHtml: body
  });
}

// ---------------------------------------------------------------------------
// Industry / use-case pages
// ---------------------------------------------------------------------------

export function renderIndustryPage(page: IndustryPage, canonicalUrl: string): string {
  const paragraphs = page.body.map((p) => `<p>${esc(p)}</p>`).join("\n");
  const toolLinks = page.toolCallouts
    .map((name) => `<li><a href="/tools/${esc(name.replace(/_/g, "-"))}"><code>${esc(name)}</code></a></li>`)
    .join("\n");

  const body = `
  <section class="hero">
    <p class="eyebrow">Use case</p>
    <h1>${esc(page.heading)}</h1>
    <p class="lede">${esc(page.lede)}</p>
  </section>

  <section>
    ${paragraphs}
  </section>

  <section>
    <h2>Relevant tools</h2>
    <ul>${toolLinks}</ul>
  </section>

  <section class="cta-row">
    <a class="btn btn-primary" href="${esc(GITHUB_URL)}">Self-host it</a>
    <a class="btn" href="/pricing">See pricing</a>
  </section>`;

  return layout({
    title: page.title,
    description: page.metaDescription,
    canonicalUrl,
    bodyHtml: body
  });
}
