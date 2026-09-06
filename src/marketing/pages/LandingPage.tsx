import type { Child } from "hono/jsx";
import { MONTHLY_QUOTA_USD } from "../../billing/quotas";
import { Button, Card, CodeWindow, Table } from "../../design";
import { TOOL_MANIFEST } from "../../mcp/manifest";
import { DISPLAY_NAME, MCP_SERVER_NAME, cloudCtaHref } from "../brand";
import { Hero } from "../components/Hero";
import { LiveFeed } from "../components/LiveFeed";
import {
  BarChartIcon,
  LinkIcon,
  SearchIcon,
  ShieldIcon,
  SparkleIcon,
  TargetIcon,
  TrendingUpIcon
} from "../components/icons";
import { TOOL_PAGES } from "../content/tool-pages";
import { GITHUB_URL } from "../github-url";
import { renderPage } from "../Layout";

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
      "Research a keyword, snapshot a SERP, inspect backlinks, audit a site, or pull GSC/GA4 without leaving the chat."
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
        lede="The same 18 tools whether we run Vouched Cloud or you self-host Community. Cite keywords, SERPs, backlinks, audits, and GSC/GA4 from Claude or Cursor — with source, freshness, and a confidence score on every fact."
        visual={<LiveFeed />}
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
          <span>MIT</span>
          <span>18 MCP tools</span>
          <span>$0 to self-host</span>
        </div>
      </Hero>

      <section>
        <p class="chapter">01 — Product</p>
        <h2>What the agent can do</h2>
        <p>
          Product capabilities, not deploy docs. Every tool returns a typed envelope: facts plus provenance so you can show where a
          number came from.
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
        <p class="chapter">02 — In the conversation</p>
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
        <p class="chapter">03 — How you run it</p>
        <h2>Choose Cloud or self-host</h2>
        <p>
          Same tools either way. The split is who operates the Worker and who holds the DataForSEO key — not which signals exist.
        </p>
        <div class="deploy-grid">
          <Card title="Vouched Cloud">
            <p>We run it. Bundled DataForSEO, dashboard, keys, and quotas. Fastest path if you do not want to operate a Worker.</p>
            <p class="muted">Pick this when you want to start in minutes.</p>
            <div class="cta-row">
              <Button href={cloudHref} variant="primary">
                Start on Cloud
              </Button>
            </div>
          </Card>
          <Card title="Self-hosted Community">
            <p>MIT, your Cloudflare Worker, bring-your-own DataForSEO key, zero markup. Full control.</p>
            <p class="muted">Pick this when you want cost control and to run it yourself.</p>
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
        <p class="chapter">04 — Price</p>
        <h2>Pricing</h2>
        <p>Community is $0. Cloud is a flat monthly quota, not credits.</p>
        <div class="pricing-rail">
          <div>
            <p class="rail-name">Community</p>
            <p class="price-amount">
              ${MONTHLY_QUOTA_USD.free} <small>/mo</small>
            </p>
            <p>Self-host. All {TOOL_MANIFEST.length} tools. BYOK for DataForSEO-backed calls.</p>
          </div>
          <div>
            <p class="rail-name">Cloud Pro</p>
            <p class="price-amount">
              ${MONTHLY_QUOTA_USD.pro} <small>/mo</small>
            </p>
            <p>Hosted. Bundled DataForSEO up to the Pro quota.</p>
          </div>
          <div>
            <p class="rail-name">Cloud Team</p>
            <p class="price-amount">
              ${MONTHLY_QUOTA_USD.team} <small>/mo</small>
            </p>
            <p>Same hosted product, larger bundled allowance.</p>
          </div>
        </div>
        <p>
          <a href="/pricing">See full pricing →</a>
        </p>
      </section>

      <section>
        <p class="chapter">05 — Open vs closed</p>
        <h2>vs OpenRush</h2>
        <Table class="compare" headers={["", DISPLAY_NAME, "OpenRush"]}>
          <tr>
            <td>Source</td>
            <td>MIT, you can read every tool</td>
            <td>Closed</td>
          </tr>
          <tr>
            <td>Where it runs</td>
            <td>Cloud or self-host</td>
            <td>Hosted only</td>
          </tr>
          <tr>
            <td>Pricing shape</td>
            <td>Community $0 + BYOK, or flat Cloud quota</td>
            <td>Credits ($10 / 1,000)</td>
          </tr>
        </Table>
        <p class="muted">
          OpenRush credit price from their public site, 6 Sep 2026. Their docs and marketing disagree on some per-tool credit costs
          (e.g. discover_competitors). We are not claiming feature-for-feature index parity.
        </p>
        <p>
          <a href="/vs/open-seo">Full comparison →</a>
        </p>
      </section>

      <section class="faq">
        <p class="chapter">06 — Questions</p>
        <h2>Frequently asked</h2>
        <details>
          <summary>Cloud or self-host — which should I pick?</summary>
          <p>
            Same 18 tools. Cloud means we operate the Worker and bundle DataForSEO. Community means you run the Worker and bring your
            own key. Speed vs control and cost.
          </p>
        </details>
        <details>
          <summary>Do I need a DataForSEO key?</summary>
          <p>
            Only for the DataForSEO-backed domains (<code>seo</code>, <code>serp</code>, <code>backlinks</code>,{" "}
            <code>ai_visibility</code>). That is a capability split, not Cloud vs Community: self-host with BYOK, or Cloud with
            bundled access. Audits, GSC, and GA4 need no paid vendor.
          </p>
        </details>
        <details>
          <summary>Is Cloud the same code?</summary>
          <p>Yes. Hosting, keys, quotas, and a dashboard sit on the same MIT codebase.</p>
        </details>
        <details>
          <summary>Can I switch later?</summary>
          <p>Yes. Clone the repo and deploy Community whenever you want; MCP clients point at a different URL.</p>
        </details>
        <details>
          <summary>What does “receipts” or provenance actually mean?</summary>
          <p>
            Every fact ships <code>source_class</code>, <code>method</code>, <code>observed_at</code>, and a{" "}
            <code>confidence</code> number. Confidence is a published default per source class (for example search_index is 0.75),
            not a statistical estimate of whether a volume number is “right.”
          </p>
        </details>
        <details>
          <summary>Which MCP clients work?</summary>
          <p>Anything that speaks MCP over HTTP with a bearer token: Claude, Cursor, and other clients with custom MCP servers.</p>
        </details>
        <details>
          <summary>How is this different from OpenRush?</summary>
          <p>
            OpenRush is closed and credit-metered. Vouched is MIT, self-hostable, and Cloud is a flat quota. Dataset URIs stay{" "}
            <code>mcpseo://</code> for compatibility.
          </p>
        </details>
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
      "Open-source MCP server for SEO and marketing data. Same 18 tools on Vouched Cloud or self-hosted Community — keyword research, backlinks, SERP, audits, GSC/GA4, with provenance on every fact.",
    canonicalUrl,
    cloudMode,
    children: <LandingPage cloudMode={cloudMode} />
  });
}
