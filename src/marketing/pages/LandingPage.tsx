import { Button, Card } from "../../design";
import { TOOL_MANIFEST } from "../../mcp/manifest";
import { Hero } from "../components/Hero";
import { TOOL_PAGES } from "../content/tool-pages";
import { renderPage } from "../Layout";
import { GITHUB_URL } from "../github-url";

const FREE_DOMAINS = new Set(["core", "audit", "gsc", "analytics"]);
const FREE_TOOL_COUNT = TOOL_MANIFEST.filter((t) => FREE_DOMAINS.has(t.domain)).length;
const DATAFORSEO_TOOL_COUNT = TOOL_MANIFEST.length - FREE_TOOL_COUNT;

function LandingPage() {
  return (
    <>
      <Hero
        eyebrow="Open source · MIT licensed · MCP-native"
        heading="SEO and marketing data, as tools your AI agent can call directly"
        lede="mcp-seo-toolkit is an open-source, self-hostable Model Context Protocol server for SEO and marketing data — keyword research, backlinks, SERP snapshots, AI-visibility, technical site audits, and your own Search Console / GA4 — plus a hosted cloud version if you'd rather not run it yourself."
      >
        <div class="cta-row">
          <Button href={GITHUB_URL} variant="primary">
            Self-host it free (MIT)
          </Button>
          <Button href="/dashboard">Use the hosted cloud version</Button>
        </div>
      </Hero>

      <section>
        <h2>Two tiers, split honestly by what backs them</h2>
        <div class="grid">
          <Card title="Free tier — zero paid vendors">
            <p>
              <code>core</code>, <code>audit</code>, <code>gsc</code>, <code>analytics</code> — {FREE_TOOL_COUNT} tools backed by
              official Google APIs (Search Console, GA4) plus a self-crawl. No DataForSEO account, no API key, nothing to pay for.
            </p>
          </Card>
          <Card title="DataForSEO-backed tier — bring your own key">
            <p>
              <code>seo</code>, <code>serp</code>, <code>backlinks</code>, <code>ai_visibility</code> — {DATAFORSEO_TOOL_COUNT} tools,
              same shapes, backed by <a href="https://dataforseo.com/">DataForSEO</a>, pay-as-you-go with your own API key.
              Self-hosted, this server never marks it up.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <h2>Why this exists</h2>
        <div class="grid">
          <Card title="Genuinely open source">
            <p>MIT licensed, the whole thing — every tool's implementation is readable and forkable, not a black box behind an API key.</p>
          </Card>
          <Card title="Zero-markup self-host">
            <p>
              Bring your own DataForSEO key and pay DataForSEO's own pay-as-you-go rate directly. No credit system, no subscription
              minimum sitting between you and the underlying data cost.
            </p>
          </Card>
          <Card title="MCP-native, not dashboard-first">
            <p>
              Every capability is a callable MCP tool with a typed, cited response — built for an AI agent to use in-conversation, not a
              dashboard you tab over to and copy numbers out of.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <h2>All 18 tools, across 8 domains</h2>
        <p>
          Every fact any tool returns carries its own provenance — source class, method, freshness, and a confidence score — instead of
          an unlabeled number you have to trust blind.
        </p>
        <ul>
          <li>
            <strong>core</strong> — capability discovery, tracked-site listing, dataset export.
          </li>
          <li>
            <strong>audit</strong> — a bounded, robots.txt-aware self-crawl with a site-health score.
          </li>
          <li>
            <strong>seo</strong> — domain snapshots, competitor discovery, keyword research and gap analysis, search-visibility tracking.
          </li>
          <li>
            <strong>serp</strong> — live SERP snapshots for a single query.
          </li>
          <li>
            <strong>backlinks</strong> — link profile inspection and backlink-gap analysis across competitors.
          </li>
          <li>
            <strong>ai_visibility</strong> — which sources AI answers cite in your category, and how your domain shows up in them.
          </li>
          <li>
            <strong>gsc</strong> / <strong>analytics</strong> — your own Search Console and GA4 data, first-party, no modeling.
          </li>
        </ul>
        <p>
          <a href="/tools">Browse all {TOOL_PAGES.length} tools →</a>
        </p>
      </section>

      <section>
        <h2>Pricing</h2>
        <p>Self-host is free forever. The hosted cloud version bundles DataForSEO access into a flat monthly plan so you don't need your own API key.</p>
        <p>
          <a href="/pricing">See full pricing →</a>
        </p>
      </section>

      <section>
        <h2>Get started</h2>
        <div class="cta-row">
          <Button href={GITHUB_URL} variant="primary">
            Read the README and self-host it
          </Button>
          <Button href="/dashboard">Sign in / start on the cloud plan</Button>
        </div>
      </section>
    </>
  );
}

export function renderLanding(canonicalUrl: string): string {
  return renderPage({
    title: "mcp-seo-toolkit — open-source MCP server for SEO data",
    description:
      "Open-source (MIT), self-hostable MCP server for SEO and marketing data: keyword research, backlinks, SERP, AI-visibility, technical audits, and your own Search Console/GA4. Also available hosted.",
    canonicalUrl,
    children: <LandingPage />
  });
}
