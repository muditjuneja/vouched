import type { Child } from "hono/jsx";
import { MONTHLY_QUOTA_USD, PLAN_PRICES_USD, TEAM_SEATS } from "../../billing/quotas";
import { Button, Card, CodeWindow } from "../../design";
import { DISPLAY_NAME, MCP_SERVER_NAME, cloudCtaHref } from "../brand";
import { AgentPreview } from "../components/AgentPreview";
import { Hero } from "../components/Hero";
import {
  BarChartIcon,
  LinkIcon,
  ReceiptIcon,
  SearchIcon,
  SparkleIcon,
  TargetIcon,
  TrendingUpIcon
} from "../components/icons";
import { GITHUB_URL } from "../github-url";
import { renderPage } from "../Layout";

interface DomainSummary {
  icon: Child;
  name: string;
  description: string;
  examplePrompt: string;
}

const DOMAIN_SUMMARIES: DomainSummary[] = [
  {
    icon: <BarChartIcon />,
    name: "gsc",
    description: "First-party Google Search Console queries, URL indexing inspection, and sitemaps.",
    examplePrompt: 'inspect_indexing({ url: "https://example.com" })'
  },
  {
    icon: <TrendingUpIcon />,
    name: "analytics",
    description: "First-party Google Analytics 4 traffic metrics, landing pages, and engagement.",
    examplePrompt: 'get_website_analytics({ domain: "example.com" })'
  },
  {
    icon: <ReceiptIcon />,
    name: "seo",
    description: "Domain snapshots, competitor discovery, keyword research, and rank tracking.",
    examplePrompt: 'research_keywords({ seedKeywords: ["open source seo"] })'
  },
  {
    icon: <TargetIcon />,
    name: "serp",
    description: "Live SERP snapshots for a single query.",
    examplePrompt: 'inspect_serp({ keyword: "best developer seo" })'
  },
  {
    icon: <LinkIcon />,
    name: "backlinks",
    description: "Link profile inspection and backlink-gap analysis across competitors.",
    examplePrompt: 'inspect_backlinks({ domain: "competitor.com" })'
  },
  {
    icon: <SparkleIcon />,
    name: "ai_visibility",
    description: "Which sources AI answers cite in your category, and how your domain shows up.",
    examplePrompt: 'discover_ai_citations({ topic: "developer tools" })'
  },
  {
    icon: <SearchIcon />,
    name: "core",
    description: "Capability discovery, tracked-site listing, dataset export.",
    examplePrompt: 'list_websites() · export_dataset("mcpseo://...")'
  }
];

const DEPLOY_COMMANDS = `npm install
wrangler d1 create ${MCP_SERVER_NAME}
npm run db:migrate:local
cp .dev.vars.example .dev.vars
npm run dev`;

const CONNECT_COMMAND = `claude mcp add --transport http ${MCP_SERVER_NAME} \\
  http://localhost:8787/mcp \\
  --header "Authorization: Bearer <your MCP_BEARER_TOKEN>"`;

interface Step {
  title: string;
  description: string;
}

const HOW_IT_WORKS: Step[] = [
  {
    title: "Connect MCP",
    description:
      "Add Vouched to Claude, Cursor, or any Model Context Protocol client. Same 18 tools on Cloud or self-host."
  },
  {
    title: "Ask in the conversation",
    description:
      "Research keywords, inspect SERPs, verify URL indexing, or pull GSC data directly from your chat."
  },
  {
    title: "Get facts with provenance",
    description:
      "Each fact includes source class, method, timestamp, and a confidence score (a published default per source, not a calibrated probability)."
  }
];

function LandingPage({ cloudMode }: { cloudMode: boolean }) {
  const cloudHref = cloudCtaHref(cloudMode);

  return (
    <>
      <Hero
        eyebrow="Open-source MCP for SEO data"
        heading={
          <>
            <span class="hero-line">SEO facts your agent can</span>
            <span class="punch">
              vouch for
              <svg class="punch-rule" viewBox="0 0 320 22" aria-hidden="true" focusable="false">
                <path d="M4 14 C 36 6, 72 18, 110 11 S 186 5, 228 13 S 286 18, 316 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
                <path d="M18 16 C 70 19, 130 8, 190 15 S 270 20, 308 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.55" />
              </svg>
            </span>
          </>
        }
        lede="Connect Claude, Cursor, or any MCP client to 18 SEO tools. Pull keyword research, live SERPs, backlink profiles, URL indexing, and verified GSC/GA4 data, with source, timestamp, and confidence on every fact."
        visual={<AgentPreview />}
      >
        <div class="cta-row">
          <Button href={cloudHref} variant="primary">
            Start on Cloud
          </Button>
          <a class="cta-text" href="#self-host">
            Self-host Community
          </a>
        </div>
        <div class="hero-chips">
          <span>Direct Google Search Console (1.0 Ground Truth)</span>
          <span>MIT</span>
          <span>18 MCP tools</span>
          <span>$0 to self-host</span>
        </div>
      </Hero>

      <section>
        <p class="chapter">01 · Product</p>
        <h2>What the agent can do</h2>
        <p>
          Every tool returns a typed envelope: facts plus provenance so you can verify where every number came from.
        </p>

        <div class="receipt-anatomy-grid">
          <div class="receipt-pillar">
            <span class="pillar-icon" aria-hidden="true">🏷️</span>
            <span class="pillar-title">Source Attribution</span>
            <p class="pillar-desc">
              Every fact cites its origin: first-party Google accounts, live SERP snapshots, or third-party search index.
            </p>
            <span class="pillar-code">source_class: "search_index"</span>
          </div>
          <div class="receipt-pillar">
            <span class="pillar-icon" aria-hidden="true">⏱️</span>
            <span class="pillar-title">Freshness Timestamp</span>
            <p class="pillar-desc">
              ISO-8601 observation timestamp on every fact, showing when data was observed.
            </p>
            <span class="pillar-code">observed_at: "2026-09-23..."</span>
          </div>
          <div class="receipt-pillar">
            <span class="pillar-icon" aria-hidden="true">🎯</span>
            <span class="pillar-title">Confidence Score</span>
            <p class="pillar-desc">
              A published default per source class (1.0 for Search Console, 0.85 live SERP, 0.75 search index) so agents weight claims accordingly.
            </p>
            <span class="pillar-code">confidence: 0.75</span>
          </div>
          <div class="receipt-pillar">
            <span class="pillar-icon" aria-hidden="true">🔒</span>
            <span class="pillar-title">Typed Envelope</span>
            <p class="pillar-desc">
              Strict JSON schemas and mcpseo:// dataset URIs. Predictable data structures an agent can parse without guessing.
            </p>
            <span class="pillar-code">fact_type: "seo.keyword_opp..."</span>
          </div>
        </div>

        <div class="domain-grid">
          {DOMAIN_SUMMARIES.map((domain) => (
            <div class="domain-tile">
              <span class="card-icon">{domain.icon}</span>
              <div>
                <h3>{domain.name}</h3>
                <p>{domain.description}</p>
                <span class="domain-prompt-tag"><code>{domain.examplePrompt}</code></span>
              </div>
            </div>
          ))}
        </div>
        <p style="margin-top:1.5rem">
          <a href="/docs">Browse all 19 tools in documentation →</a>
        </p>
      </section>

      <section>
        <p class="chapter">02 · In the conversation</p>
        <h2>How it works</h2>
        <ol class="chapter-steps">
          {HOW_IT_WORKS.map((step, index) => (
            <li>
              <span class="step-idx">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="self-host">
        <p class="chapter">03 · How you run it</p>
        <h2>Choose Cloud or self-host</h2>
        <p>
          Same tools either way. The split is who operates the Worker and who holds the DataForSEO key, not which signals exist.
        </p>
        <div class="deploy-grid">
          <Card title="Vouched Cloud">
            <span class="deploy-badge cloud">Managed Cloud</span>
            <p>Hosted on Cloudflare Workers with bundled DataForSEO, key management, and a dashboard.</p>
            <p class="muted">Pick this if you don't want to operate a Worker or manage vendor keys.</p>
            <div class="cta-row">
              <Button href={cloudHref} variant="primary">
                Start on Cloud
              </Button>
            </div>
          </Card>
          <Card title="Self-hosted Community">
            <span class="deploy-badge oss">MIT Open Source</span>
            <p>Deploy to your own Cloudflare account. Bring your own DataForSEO key with zero markup.</p>
            <p class="muted">Pick this for full control, privacy, and zero software subscription fees.</p>
            <div id="quickstart">
              <CodeWindow title="Community quickstart">{`${DEPLOY_COMMANDS}

# then connect it
${CONNECT_COMMAND}`}</CodeWindow>
            </div>
            <p class="muted" style="margin-top:1rem">
              Full setup is in the <a href={GITHUB_URL}>self-host guide</a>.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <p class="chapter">04 · Price</p>
        <h2>Pricing</h2>
        <p>Community is $0. Cloud is a flat monthly quota, not credits.</p>
        <div class="pricing-rail">
          <div>
            <span class="rail-tag">Self-Host · Free Forever</span>
            <p class="rail-name">Community</p>
            <p class="price-amount">
              ${PLAN_PRICES_USD.free} <small>/mo</small>
            </p>
            <p>Self-host on Cloudflare Workers. All 18 tools. Free tier needs no vendor; BYOK for DataForSEO.</p>
          </div>
          <div>
            <span class="rail-tag highlight">Most Popular · Bundled Quota</span>
            <p class="rail-name">Cloud Pro</p>
            <p class="price-amount">
              ${PLAN_PRICES_USD.pro} <small>/mo</small>
            </p>
            <p>Hosted for you. Includes ${MONTHLY_QUOTA_USD.pro}/mo of DataForSEO usage, dashboard, and key management.</p>
          </div>
          <div>
            <span class="rail-tag">Scale · Team Allowance</span>
            <p class="rail-name">Cloud Team</p>
            <p class="price-amount">
              ${PLAN_PRICES_USD.team} <small>/mo</small>
            </p>
            <p>{TEAM_SEATS} seats in one shared workspace. Includes ${MONTHLY_QUOTA_USD.team}/mo of DataForSEO usage.</p>
          </div>
        </div>
        <p>
          <a href="/pricing">See full pricing →</a>
        </p>
      </section>

      <section class="faq">
        <p class="chapter">05 · Questions</p>
        <h2>Frequently asked</h2>
        <div class="faq-list">
          <details open>
            <summary>Cloud or self-host: which should I pick?</summary>
            <div class="faq-answer">
              <p>
                Same 18 tools. Cloud means we host the Worker and bundle DataForSEO access.
                Community means you deploy to your own Cloudflare account with your own key. Speed
                vs control and cost.
              </p>
            </div>
          </details>
          <details open>
            <summary>Do I need a DataForSEO key?</summary>
            <div class="faq-answer">
              <p>
                Only for the DataForSEO-backed domains (<code>seo</code>, <code>serp</code>, <code>backlinks</code>,{" "}
                <code>ai_visibility</code>). That is a capability split, not Cloud vs Community: self-host with BYOK, or Cloud with
                bundled access. Search Console, GA4, and core tools need no paid vendor key.
              </p>
            </div>
          </details>
          <details>
            <summary>Is Cloud the same code?</summary>
            <div class="faq-answer">
              <p>Yes. The cloud service runs the same MIT codebase with added hosting, quota tracking, and auth.</p>
            </div>
          </details>
          <details>
            <summary>Can I switch later?</summary>
            <div class="faq-answer">
              <p>Yes. Deploy Community to your own Cloudflare account anytime. Simply update the MCP URL in your client.</p>
            </div>
          </details>
          <details>
            <summary>What does “receipts” or provenance actually mean?</summary>
            <div class="faq-answer">
              <p>
                Every fact includes <code>source_class</code>, <code>method</code>, <code>observed_at</code>, and a{" "}
                <code>confidence</code> score. Confidence is a published default per source class (for example Search Console is 1.0,
                live SERP is 0.85, search index is 0.75), not a statistical estimate of whether a volume number is exact.
              </p>
            </div>
          </details>
          <details>
            <summary>Which MCP clients work?</summary>
            <div class="faq-answer">
              <p>Claude Desktop, Claude Code, Cursor, and any client supporting MCP over HTTP with bearer authentication.</p>
            </div>
          </details>
        </div>
      </section>

      <section>
        <h2>Get started</h2>
        <div class="cta-row">
          <Button href={cloudHref} variant="primary">
            Start on Cloud
          </Button>
          <a class="cta-text" href="#self-host">
            Self-host Community
          </a>
        </div>
      </section>
    </>
  );
}

export function renderLanding(canonicalUrl: string, cloudMode: boolean): string {
  return renderPage({
    title: `${DISPLAY_NAME}: SEO facts your agent can vouch for`,
    description:
      "Open-source MCP server for SEO and marketing data. Same 18 tools on Vouched Cloud or self-hosted Community: keyword research, backlinks, SERP, URL indexing, GSC/GA4, with provenance on every fact.",
    canonicalUrl,
    cloudMode,
    children: <LandingPage cloudMode={cloudMode} />
  });
}
