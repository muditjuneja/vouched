import type { Child } from "hono/jsx";
import { Button, Card, CodeWindow } from "../../design";
import { TOOL_MANIFEST } from "../../mcp/manifest";
import { Hero } from "../components/Hero";
import {
  BarChartIcon,
  ChatIcon,
  CodeIcon,
  LinkIcon,
  ReceiptIcon,
  SearchIcon,
  ShieldIcon,
  SparkleIcon,
  TargetIcon,
  TrendingUpIcon
} from "../components/icons";
import { TOOL_PAGES } from "../content/tool-pages";
import { renderPage } from "../Layout";
import { GITHUB_URL } from "../github-url";

interface DomainSummary {
  icon: Child;
  name: string;
  description: string;
}

const DOMAIN_SUMMARIES: DomainSummary[] = [
  { icon: <SearchIcon />, name: "core", description: "Capability discovery, tracked-site listing, dataset export." },
  { icon: <ShieldIcon />, name: "audit", description: "A bounded, robots.txt-aware self-crawl with a site-health score." },
  {
    icon: <TrendingUpIcon />,
    name: "seo",
    description: "Domain snapshots, competitor discovery, keyword research and gap analysis, search-visibility tracking."
  },
  { icon: <TargetIcon />, name: "serp", description: "Live SERP snapshots for a single query." },
  { icon: <LinkIcon />, name: "backlinks", description: "Link profile inspection and backlink-gap analysis across competitors." },
  { icon: <SparkleIcon />, name: "ai_visibility", description: "Which sources AI answers cite in your category, and how your domain shows up in them." },
  { icon: <BarChartIcon />, name: "gsc / analytics", description: "Your own Search Console and GA4 data, first-party, no modeling." }
];

const FREE_DOMAINS = new Set(["core", "audit", "gsc", "analytics"]);
const FREE_TOOL_COUNT = TOOL_MANIFEST.filter((t) => FREE_DOMAINS.has(t.domain)).length;
const DATAFORSEO_TOOL_COUNT = TOOL_MANIFEST.length - FREE_TOOL_COUNT;

/** A real (trimmed) example of the OFE envelope shape every tool returns — see docs/OFE_ENVELOPE.md. Shown as the hero's "product shot" since no image pipeline exists in this repo. */
function ExampleCall() {
  return (
    <CodeWindow title="research_keywords('vector database')">
      {"{\n"}
      {"  "}
      <span class="tok-key">"domain"</span>
      <span class="tok-punc">: </span>
      <span class="tok-str">"seo"</span>
      <span class="tok-punc">,</span>
      {"\n  "}
      <span class="tok-key">"facts"</span>
      <span class="tok-punc">: [{"{"}</span>
      {"\n    "}
      <span class="tok-key">"type"</span>
      <span class="tok-punc">: </span>
      <span class="tok-str">"seo.keyword"</span>
      <span class="tok-punc">,</span>
      {"\n    "}
      <span class="tok-key">"value"</span>
      <span class="tok-punc">: {"{"} </span>
      <span class="tok-key">"volume"</span>
      <span class="tok-punc">: </span>
      <span class="tok-num">8100</span>
      <span class="tok-punc"> {"}"},</span>
      {"\n    "}
      <span class="tok-key">"provenance"</span>
      <span class="tok-punc">: {"{"}</span>
      {"\n      "}
      <span class="tok-key">"source_class"</span>
      <span class="tok-punc">: </span>
      <span class="tok-str">"search_index"</span>
      <span class="tok-punc">,</span>
      {"\n      "}
      <span class="tok-key">"confidence"</span>
      <span class="tok-punc">: </span>
      <span class="tok-num">0.92</span>
      <span class="tok-punc">,</span>
      {"\n      "}
      <span class="tok-comment">// not "trust me" — a real number</span>
      {"\n    "}
      <span class="tok-punc">{"}"}</span>
      {"\n  "}
      <span class="tok-punc">{"}"}]</span>
      {"\n"}
      <span class="tok-punc">{"}"}</span>
    </CodeWindow>
  );
}

function LandingPage() {
  return (
    <>
      <Hero
        eyebrow="Open source · MIT licensed · MCP-native"
        heading={
          <>
            SEO data with <span class="gradient-text">receipts</span>, not another black box
          </>
        }
        lede="Every fact this server returns carries its source, its freshness, and a confidence score — so your AI agent (and you) can tell a real number from a modeled guess. Called directly mid-conversation, not copy-pasted from a dashboard tab."
        visual={<ExampleCall />}
      >
        <div class="cta-row">
          <Button href={GITHUB_URL} variant="primary">
            Self-host it free (MIT)
          </Button>
          <Button href="/dashboard">Use the hosted cloud version</Button>
        </div>
        <div class="hero-stats">
          <div class="hero-stat">
            <strong>18</strong>
            <span>MCP tools</span>
          </div>
          <div class="hero-stat">
            <strong>8</strong>
            <span>data domains</span>
          </div>
          <div class="hero-stat">
            <strong>MIT</strong>
            <span>fully open source</span>
          </div>
          <div class="hero-stat">
            <strong>$0</strong>
            <span>markup, self-hosted</span>
          </div>
        </div>
        <p class="muted" style="margin-top:1.5rem">
          Built on the <a href="https://modelcontextprotocol.io">Model Context Protocol</a> — an open standard, not a proprietary
          plugin format only one vendor's agent can use.
        </p>
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

      <section class="band">
        <h2>The three things that actually get in your way</h2>
        <div class="grid">
          <Card icon={<CodeIcon />} title="Closed-source scores you have to take on faith">
            <p>
              Most SEO tools hand you a number with no way to see how it was computed. This one's MIT licensed end to end — read
              exactly how every tool works, fork it, fix it yourself if something's wrong.
            </p>
          </Card>
          <Card icon={<ReceiptIcon />} title="Credit systems that hide what a query actually costs">
            <p>
              Bring your own DataForSEO key and pay their real pay-as-you-go rate directly — no credit conversion to do math on, no
              markup, no subscription minimum sitting between you and the underlying data cost.
            </p>
          </Card>
          <Card icon={<ChatIcon />} title="Tab-switching to a dashboard mid-conversation">
            <p>
              Every capability is a callable MCP tool with a typed, cited response — built to be used in-conversation by your AI
              agent, not a dashboard you alt-tab to and copy numbers out of.
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
        <div class="domain-grid">
          {DOMAIN_SUMMARIES.map((domain) => (
            <div class="domain-tile">
              <span class="card-icon">{domain.icon}</span>
              <div>
                <h3>{domain.name}</h3>
                <p>{domain.description}</p>
              </div>
            </div>
          ))}
        </div>
        <p style="margin-top:1.5rem">
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
