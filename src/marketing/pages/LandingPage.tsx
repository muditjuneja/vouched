import type { Child } from "hono/jsx";
import { Button, Card, CodeWindow } from "../../design";
import { TOOL_MANIFEST } from "../../mcp/manifest";
import { Hero } from "../components/Hero";
import {
  BarChartIcon,
  ChatIcon,
  LinkIcon,
  LockIcon,
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

/**
 * Small data-driven token/line renderer for the hero's syntax-highlighted
 * JSON example: one `{ indent, tokens }` per line instead of dozens of
 * individually hand-placed `<span class="tok-*">` / `{"\n  "}` string
 * literals (easy to typo a token class or miscount a brace, hard to
 * review, painful to extend by even one field). Indentation is plain text
 * (spaces carry no color either way); only the genuinely colored pieces,
 * keys, strings, numbers, punctuation, comments, become `.tok-*` spans,
 * matching the classes already in src/design/base-styles.ts.
 */
type Token = { text: string; cls: "key" | "str" | "num" | "punc" | "comment" };
const key = (text: string): Token => ({ text, cls: "key" });
const str = (text: string): Token => ({ text, cls: "str" });
const num = (text: string): Token => ({ text, cls: "num" });
const punc = (text: string): Token => ({ text, cls: "punc" });
const comment = (text: string): Token => ({ text, cls: "comment" });

interface Line {
  indent: number;
  tokens: Token[];
}

function renderLines(lines: Line[]): Child {
  return (
    <>
      {lines.map((line, i) => (
        <>
          {i > 0 ? "\n" : ""}
          {"  ".repeat(line.indent)}
          {line.tokens.map((tok) => (
            <span class={`tok-${tok.cls}`}>{tok.text}</span>
          ))}
        </>
      ))}
    </>
  );
}

/**
 * A real (trimmed) example of the OFE envelope shape every tool returns.
 * Field names and the fact `type` match docs/OFE_ENVELOPE.md and
 * src/domains/seo/research-keywords.ts exactly (`data`, not an invented
 * `value`; `seo.keyword_opportunity`, not `seo.keyword`). The 0.75
 * confidence is `search_index`'s real default from
 * src/envelope/provenance.ts, not a made-up number. Shown as the hero's
 * "product shot" since no image pipeline exists in this repo.
 */
const EXAMPLE_LINES: Line[] = [
  { indent: 0, tokens: [punc("{")] },
  { indent: 1, tokens: [key('"domain"'), punc(": "), str('"seo"'), punc(",")] },
  { indent: 1, tokens: [key('"facts"'), punc(": [{")] },
  { indent: 2, tokens: [key('"type"'), punc(": "), str('"seo.keyword_opportunity"'), punc(",")] },
  { indent: 2, tokens: [key('"data"'), punc(": {")] },
  { indent: 3, tokens: [key('"keyword"'), punc(": "), str('"vector database"'), punc(",")] },
  { indent: 3, tokens: [key('"search_volume"'), punc(": "), num("8100")] },
  { indent: 2, tokens: [punc("},")] },
  { indent: 2, tokens: [key('"provenance"'), punc(": {")] },
  { indent: 3, tokens: [key('"source_class"'), punc(": "), str('"search_index"'), punc(",")] },
  { indent: 3, tokens: [key('"confidence"'), punc(": "), num("0.75"), punc(",")] },
  { indent: 3, tokens: [comment('// not "trust me", a real number')] },
  { indent: 2, tokens: [punc("}")] },
  { indent: 1, tokens: [punc("}]")] },
  { indent: 0, tokens: [punc("}")] }
];

function ExampleCall() {
  return <CodeWindow title="research_keywords('vector database')">{renderLines(EXAMPLE_LINES)}</CodeWindow>;
}

const DEPLOY_COMMANDS = `npm install
wrangler d1 create mcp-seo-toolkit
npm run db:migrate:local
cp .dev.vars.example .dev.vars
npm run dev`;

const CONNECT_COMMAND = `claude mcp add --transport http mcp-seo-toolkit \\
  http://localhost:8787/mcp \\
  --header "Authorization: Bearer <your MCP_BEARER_TOKEN>"`;

interface Step {
  icon: Child;
  title: string;
  description: string;
}

const HOW_IT_WORKS: Step[] = [
  {
    icon: <span class="step-num">1</span>,
    title: "Run it",
    description: "Self-host your own copy on Cloudflare Workers, or sign in to the hosted cloud version. Same 18 tools either way."
  },
  {
    icon: <span class="step-num">2</span>,
    title: "Connect it",
    description: 'Add it to Claude Code (or any MCP client) with one command, an Authorization header, and it shows up as callable tools.'
  },
  {
    icon: <span class="step-num">3</span>,
    title: "Ask for it",
    description: "Your AI agent calls a tool mid-conversation. Keyword research, a backlink check, a technical audit: no tab-switching."
  },
  {
    icon: <span class="step-num">4</span>,
    title: "Get a real fact back",
    description: "Every result carries its source, freshness, and a confidence score, so you can tell a real number from a modeled guess."
  }
];

function LandingPage({ cloudMode }: { cloudMode: boolean }) {
  return (
    <>
      <Hero
        eyebrow="Open source · MIT licensed · MCP-native"
        heading={
          <>
            SEO data with <span class="gradient-text">receipts</span>, not another black box
          </>
        }
        lede="Every fact this server returns carries its source, its freshness, and a confidence score, so your AI agent (and you) can tell a real number from a modeled guess. Called directly mid-conversation, not copy-pasted from a dashboard tab."
        visual={<ExampleCall />}
      >
        <div class="cta-row">
          <Button href={GITHUB_URL} variant="primary">
            Self-host it free (MIT)
          </Button>
          {cloudMode ? (
            <Button href="/dashboard">Use the hosted cloud version</Button>
          ) : (
            <Button href="#quickstart">See the quickstart</Button>
          )}
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
          Built on the <a href="https://modelcontextprotocol.io">Model Context Protocol</a>, an open standard, not a proprietary plugin
          format only one vendor's agent can use.
        </p>
      </Hero>

      <section id="quickstart">
        <h2>Get it running in a few minutes</h2>
        <p>Real commands, not a sales pitch. Clone it, point it at a Cloudflare account, and it's live.</p>
        <div class="quickstart-grid">
          <CodeWindow title="1. Deploy it">{DEPLOY_COMMANDS}</CodeWindow>
          <CodeWindow title="2. Connect it">{CONNECT_COMMAND}</CodeWindow>
        </div>
        <p class="muted" style="margin-top:1.5rem">
          Full setup, including deploying to production and connecting Google Search Console/Analytics, is in the{" "}
          <a href={GITHUB_URL}>self-host guide</a>.
        </p>
      </section>

      <section>
        <h2>How it works</h2>
        <div class="steps-grid">
          {HOW_IT_WORKS.map((step) => (
            <Card icon={step.icon} title={step.title}>
              <p>{step.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2>Two tiers, split honestly by what backs them</h2>
        <div class="grid">
          <Card title="Free tier: zero paid vendors">
            <p>
              <code>core</code>, <code>audit</code>, <code>gsc</code>, <code>analytics</code>: {FREE_TOOL_COUNT} tools backed by official
              Google APIs (Search Console, GA4) plus a self-crawl. No DataForSEO account, no API key, nothing to pay for.
            </p>
          </Card>
          <Card title="DataForSEO-backed tier: bring your own key">
            <p>
              <code>seo</code>, <code>serp</code>, <code>backlinks</code>, <code>ai_visibility</code>: {DATAFORSEO_TOOL_COUNT} tools,
              same shapes, backed by <a href="https://dataforseo.com/">DataForSEO</a>, pay-as-you-go with your own API key. Self-hosted,
              this server never marks it up.
            </p>
          </Card>
        </div>
      </section>

      <section class="band">
        <h2>The three things that actually get in your way</h2>
        <div class="grid">
          <Card icon={<LockIcon />} title="Closed-source scores you have to take on faith">
            <p>
              Most SEO tools hand you a number with no way to see how it was computed. This one's MIT licensed end to end: read exactly
              how every tool works, fork it, fix it yourself if something's wrong.
            </p>
          </Card>
          <Card icon={<ReceiptIcon />} title="Credit systems that hide what a query actually costs">
            <p>
              Bring your own DataForSEO key and pay their real pay-as-you-go rate directly. No credit conversion to do math on, no
              markup, no subscription minimum sitting between you and the underlying data cost.
            </p>
          </Card>
          <Card icon={<ChatIcon />} title="Tab-switching to a dashboard mid-conversation">
            <p>
              Every capability is a callable MCP tool with a typed, cited response, built to be used in-conversation by your AI agent,
              not a dashboard you alt-tab to and copy numbers out of.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <h2>All 18 tools, across 8 domains</h2>
        <p>
          Every fact any tool returns carries its own provenance: source class, method, freshness, and a confidence score, instead of an
          unlabeled number you have to trust blind.
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
          {cloudMode ? (
            <Button href="/dashboard">Sign in / start on the cloud plan</Button>
          ) : (
            <Button href="#quickstart">Jump to the quickstart</Button>
          )}
        </div>
      </section>
    </>
  );
}

export function renderLanding(canonicalUrl: string, cloudMode: boolean): string {
  return renderPage({
    title: "mcp-seo-toolkit: open-source MCP server for SEO data",
    description:
      "Open-source (MIT), self-hostable MCP server for SEO and marketing data: keyword research, backlinks, SERP, AI-visibility, technical audits, and your own Search Console/GA4. Also available hosted.",
    canonicalUrl,
    cloudMode,
    children: <LandingPage cloudMode={cloudMode} />
  });
}
