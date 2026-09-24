import { Button, Table } from "../../design";
import {
  FREE_DAILY_TOOL_CALLS,
  MIN_TOPUP_USD,
  MONTHLY_QUOTA_USD,
  OVERAGE_MARKUP_MULTIPLIER,
  PLAN_PRICES_USD,
  RATE_LIMIT_PER_MINUTE,
  TEAM_SEATS
} from "../../billing/quotas";
import { TOOL_MANIFEST } from "../../mcp/manifest";
import { Hero } from "../components/Hero";
import { CheckIcon } from "../components/icons";
import { PricingCard } from "../components/PricingCard";
import { DISPLAY_NAME, cloudCta, cloudCtaHref } from "../brand";
import { GITHUB_URL } from "../github-url";
import { renderPage } from "../Layout";

/**
 * Every number here comes from src/billing/quotas.ts or the tool manifest,
 * so the page can't drift from what the product enforces.
 */
const LIVE_TOOLS = TOOL_MANIFEST.filter((tool) => tool.implemented);
const GOOGLE_TOOL_COUNT = LIVE_TOOLS.filter((tool) => tool.billing === "free").length;
const MARKET_TOOL_COUNT = LIVE_TOOLS.filter((tool) => tool.billing === "dataforseo").length;
const MARKUP_PCT = Math.round((OVERAGE_MARKUP_MULTIPLIER - 1) * 100);

function Yes() {
  return (
    <span class="compare-yes">
      <CheckIcon /> Yes
    </span>
  );
}

function No() {
  return <span class="compare-no">No</span>;
}

function PricingPage({ cloudMode, signedIn }: { cloudMode: boolean; signedIn: boolean }) {
  const free = cloudCta(cloudMode, signedIn);
  const paidHref = cloudMode ? (signedIn ? "/dashboard/billing" : cloudCtaHref(true)) : "/pricing#cloud";
  const notHere = !cloudMode ? (
    <p class="muted">This server doesn't run the hosted plans; this describes {DISPLAY_NAME} Cloud at vouchedhq.com.</p>
  ) : null;

  return (
    <>
      <Hero
        eyebrow="Pricing"
        heading="Start free with your own Google data. Pay when you need market data."
        lede="Your Search Console and Analytics data is free. Keyword, backlink, SERP and AI-visibility data costs us real money per call, so it comes with Pro and Team, at cost."
      />

      <section id="cloud">
        <p class="chapter">Cloud plans</p>
        <div class="pricing-grid">
          <PricingCard name="Free" price="$0" priceNote="/mo" ctaLabel={signedIn && cloudMode ? free.label : "Start free"} ctaHref={free.href}>
            <p>Your own Google data, in any AI app that supports MCP.</p>
            <ul>
              <li>{GOOGLE_TOOL_COUNT} tools for your Search Console and GA4 data</li>
              <li>
                Up to {FREE_DAILY_TOOL_CALLS} tool calls a day, {RATE_LIMIT_PER_MINUTE.free} a minute
              </li>
              <li>Connect Claude, Cursor or VS Code by signing in</li>
              <li>Dashboard for websites, usage and API keys</li>
            </ul>
            {notHere}
          </PricingCard>

          <PricingCard
            name="Pro"
            price={`$${PLAN_PRICES_USD.pro}`}
            priceNote="/mo"
            ctaLabel={signedIn ? "Choose Pro in Billing" : "Start on Pro"}
            ctaHref={paidHref}
            featured
            primaryCta
          >
            <p>Add market data: what people search for, who ranks, and who links to whom.</p>
            <ul>
              <li>Everything in Free, with no daily cap</li>
              <li>{MARKET_TOOL_COUNT} keyword, backlink, SERP and AI-visibility tools</li>
              <li>${MONTHLY_QUOTA_USD.pro} of market data included each month, at cost</li>
              <li>
                Beyond that, a prepaid wallet at cost plus {MARKUP_PCT}%, from ${MIN_TOPUP_USD}
              </li>
              <li>{RATE_LIMIT_PER_MINUTE.paid} tool calls a minute</li>
            </ul>
            {notHere}
          </PricingCard>

          <PricingCard
            name="Team"
            price={`$${PLAN_PRICES_USD.team}`}
            priceNote="/mo"
            ctaLabel={signedIn ? "Choose Team in Billing" : "Start on Team"}
            ctaHref={paidHref}
          >
            <p>Pro for up to {TEAM_SEATS} people sharing one workspace.</p>
            <ul>
              <li>Everything in Pro</li>
              <li>{TEAM_SEATS} seats, owner included, invite by email</li>
              <li>Shared websites and Google connections</li>
              <li>${MONTHLY_QUOTA_USD.team} of market data included each month, at cost</li>
              <li>Each person signs in with their own account</li>
            </ul>
            {notHere}
          </PricingCard>
        </div>
      </section>

      <section id="self-host-plan">
        <p class="chapter">Run it yourself</p>
        <h2>Community: free, MIT licensed</h2>
        <p>
          Deploy your own copy to your Cloudflare account. You get all {LIVE_TOOLS.length} tools. The market-data tools use your own
          DataForSEO account, which bills you directly at its prices, with nothing added. Self-hosting has no dashboard, sign-in or team
          features: it's one server, protected by a token you set.
        </p>
        <div class="cta-row">
          <Button href={GITHUB_URL}>Self-host it</Button>
        </div>
      </section>

      <section>
        <h2>Compare plans</h2>
        <Table class="compare" headers={["", "Free", "Pro", "Team", "Self-host"]}>
          <tr>
            <td>Price</td>
            <td>$0</td>
            <td>${PLAN_PRICES_USD.pro}/mo</td>
            <td>${PLAN_PRICES_USD.team}/mo</td>
            <td>$0, plus your own DataForSEO bill</td>
          </tr>
          <tr>
            <td>Search Console and GA4 tools ({GOOGLE_TOOL_COUNT})</td>
            <td>
              <Yes />
            </td>
            <td>
              <Yes />
            </td>
            <td>
              <Yes />
            </td>
            <td>
              <Yes />
            </td>
          </tr>
          <tr>
            <td>Market-data tools ({MARKET_TOOL_COUNT})</td>
            <td>
              <No />
            </td>
            <td>
              <Yes />
            </td>
            <td>
              <Yes />
            </td>
            <td>With your DataForSEO key</td>
          </tr>
          <tr>
            <td>Market data included each month</td>
            <td>None</td>
            <td>${MONTHLY_QUOTA_USD.pro}</td>
            <td>${MONTHLY_QUOTA_USD.team}</td>
            <td>Pay DataForSEO directly</td>
          </tr>
          <tr>
            <td>More market data</td>
            <td>Upgrade</td>
            <td>Wallet, cost + {MARKUP_PCT}%</td>
            <td>Wallet, cost + {MARKUP_PCT}%</td>
            <td>Pay DataForSEO directly</td>
          </tr>
          <tr>
            <td>Tool calls</td>
            <td>
              {FREE_DAILY_TOOL_CALLS}/day, {RATE_LIMIT_PER_MINUTE.free}/min
            </td>
            <td>{RATE_LIMIT_PER_MINUTE.paid}/min</td>
            <td>{RATE_LIMIT_PER_MINUTE.paid}/min</td>
            <td>Your own limits</td>
          </tr>
          <tr>
            <td>People</td>
            <td>1</td>
            <td>1</td>
            <td>{TEAM_SEATS}</td>
            <td>Anyone with your token</td>
          </tr>
          <tr>
            <td>Connect by signing in</td>
            <td>
              <Yes />
            </td>
            <td>
              <Yes />
            </td>
            <td>
              <Yes />
            </td>
            <td>Shared token only</td>
          </tr>
          <tr>
            <td>Dashboard</td>
            <td>
              <Yes />
            </td>
            <td>
              <Yes />
            </td>
            <td>
              <Yes />
            </td>
            <td>
              <No />
            </td>
          </tr>
          <tr>
            <td>Who runs it</td>
            <td>Us</td>
            <td>Us</td>
            <td>Us</td>
            <td>You</td>
          </tr>
        </Table>
      </section>

      <section class="faq">
        <h2>Frequently asked</h2>
        <div class="faq-list">
          <details open>
            <summary>What counts as "market data", and why isn't it free?</summary>
            <div class="faq-answer">
              <p>
                Keyword volumes, rankings, live search results, backlinks and AI-answer citations. We buy it per call from a data
                provider, so it can't be unlimited on a free plan. Your own Search Console and Analytics data costs us nothing, so that
                part is free.
              </p>
            </div>
          </details>
          <details>
            <summary>What happens when I use up my included market data?</summary>
            <div class="faq-answer">
              <p>
                Calls draw from your prepaid wallet, charged at cost plus {MARKUP_PCT}%. Top it up from Billing (${MIN_TOPUP_USD} minimum).
                With an empty wallet, market-data calls stop until your next billing period; your Google data keeps working. Every call and
                its cost is listed under Usage.
              </p>
            </div>
          </details>
          <details>
            <summary>How do I connect it to my AI app?</summary>
            <div class="faq-answer">
              <p>
                Add <code>https://vouchedhq.com/mcp</code> in Claude, Claude Code, Cursor or VS Code and sign in; no key to copy. For
                scripts or apps that can't sign in, create an API key in the dashboard.
              </p>
            </div>
          </details>
          <details>
            <summary>How do Team seats work?</summary>
            <div class="faq-answer">
              <p>
                The owner invites people by email from Settings. Everyone shares the workspace's websites, Google connections and included
                market data, and signs in with their own account. Only the owner manages billing. Removing someone ends their access
                immediately.
              </p>
            </div>
          </details>
          <details>
            <summary>Can I cancel?</summary>
            <div class="faq-answer">
              <p>
                Anytime, from Billing. Your workspace moves to the Free plan, so your Google tools keep working. Any wallet balance is kept
                in case you come back.
              </p>
            </div>
          </details>
          <details>
            <summary>Is the hosted version the same code as self-hosting?</summary>
            <div class="faq-answer">
              <p>
                Yes: the same open-source tools. Cloud adds hosting, bundled market data, sign-in, teams and the dashboard. You can move to
                your own copy at any time.
              </p>
            </div>
          </details>
        </div>
      </section>
    </>
  );
}

export function renderPricing(canonicalUrl: string, cloudMode: boolean, signedIn = false): string {
  return renderPage({
    title: `Pricing · ${DISPLAY_NAME}`,
    description: `Free for your own Search Console and GA4 data. Pro ($${PLAN_PRICES_USD.pro}/mo) and Team ($${PLAN_PRICES_USD.team}/mo) add keyword, backlink, SERP and AI-visibility data at cost. Or self-host for free.`,
    canonicalUrl,
    cloudMode,
    signedIn,
    children: <PricingPage cloudMode={cloudMode} signedIn={signedIn} />
  });
}
