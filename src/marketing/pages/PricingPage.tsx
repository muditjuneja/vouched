import { Table } from "../../design";
import { MONTHLY_QUOTA_USD } from "../../billing/quotas";
import { TOOL_MANIFEST } from "../../mcp/manifest";
import { Hero } from "../components/Hero";
import { CheckIcon } from "../components/icons";
import { PricingCard } from "../components/PricingCard";
import { DISPLAY_NAME, cloudCtaHref } from "../brand";
import { GITHUB_URL } from "../github-url";
import { renderPage } from "../Layout";

/** A checkmark instead of the word "Yes": more scannable in a comparison table. */
function Yes() {
  return (
    <span class="compare-yes">
      <CheckIcon /> Yes
    </span>
  );
}

function PricingPage({ cloudMode }: { cloudMode: boolean }) {
  return (
    <>
      <Hero eyebrow="Pricing" heading="Community is free. Cloud is convenience, not a different product." lede="Every plan gets the same 18 tools. What changes is who runs the Worker and who holds the DataForSEO account." />

      <section id="cloud">
        <p class="chapter">Plans</p>
        <div class="pricing-grid">
        <PricingCard name="Community (self-host)" price="$0" priceNote="/mo, forever" ctaLabel="Self-host it" ctaHref={GITHUB_URL} primaryCta>
          <p>
            Deploy your own copy to Cloudflare Workers. All 18 tools, including the DataForSEO-backed ones if you bring your own API key
            (billed by DataForSEO directly, zero markup).
          </p>
          <ul>
            <li>All {TOOL_MANIFEST.length} MCP tools</li>
            <li>Free tier tools need no paid vendor at all</li>
            <li>BYOK for DataForSEO-backed tools</li>
            <li>Full source access, MIT licensed</li>
          </ul>
        </PricingCard>

        <PricingCard
          name="Pro (Cloud)"
          price={`$${MONTHLY_QUOTA_USD.pro}`}
          priceNote="/mo, included usage"
          ctaLabel="Start on Pro"
          ctaHref={cloudMode ? cloudCtaHref(true) : "/pricing#cloud"}
          featured
          primaryCta
        >
          <p>
            Hosted for you. Bundled DataForSEO access, no API key to manage, with ${MONTHLY_QUOTA_USD.pro}/mo of underlying DataForSEO
            cost included before you'd need to talk to us about more.
          </p>
          <ul>
            <li>Everything in Community</li>
            <li>No DataForSEO account needed</li>
            <li>Dashboard: connection status, usage, API keys</li>
            <li>MCP API key management (create / revoke)</li>
          </ul>
          {!cloudMode ? <p class="muted">Not enabled on this deployment; this describes the hosted cloud plan, not this server.</p> : null}
        </PricingCard>

        <PricingCard
          name="Team (Cloud)"
          price={`$${MONTHLY_QUOTA_USD.team}`}
          priceNote="/mo, included usage"
          ctaLabel="Start on Team"
          ctaHref={cloudMode ? cloudCtaHref(true) : "/pricing#cloud"}
        >
          <p>
            Same hosted product as Pro, with a larger bundled DataForSEO allowance: ${MONTHLY_QUOTA_USD.team}/mo of underlying cost
            included, for teams tracking more sites or running more research per month.
          </p>
          <ul>
            <li>Everything in Pro</li>
            <li>Higher bundled DataForSEO quota</li>
            <li>Same per-tenant dashboard and key management</li>
          </ul>
          {!cloudMode ? <p class="muted">Not enabled on this deployment; this describes the hosted cloud plan, not this server.</p> : null}
        </PricingCard>
        </div>
      </section>

      <section>
        <h2>Full comparison</h2>
        <Table class="compare" headers={["Feature", "Community (self-host)", "Pro (Cloud)", "Team (Cloud)"]}>
          <tr>
            <td>Who runs the server</td>
            <td>You</td>
            <td>Us</td>
            <td>Us</td>
          </tr>
          <tr>
            <td>All 18 MCP tools</td>
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
            <td>Free-tier tools (core/gsc/analytics)</td>
            <td>
              <Yes /> no paid vendor
            </td>
            <td>
              <Yes />
            </td>
            <td>
              <Yes />
            </td>
          </tr>
          <tr>
            <td>DataForSEO access</td>
            <td>Bring your own key, billed by DataForSEO directly</td>
            <td>Bundled, ${MONTHLY_QUOTA_USD.pro}/mo included</td>
            <td>Bundled, ${MONTHLY_QUOTA_USD.team}/mo included</td>
          </tr>
          <tr>
            <td>Dashboard (sites, usage, API keys)</td>
            <td class="compare-no">Self-managed</td>
            <td>
              <Yes />
            </td>
            <td>
              <Yes />
            </td>
          </tr>
          <tr>
            <td>Source code</td>
            <td colspan={3}>MIT licensed for everyone, on every plan</td>
          </tr>
        </Table>
        <p class="muted">
          Cloud quota amounts are the deployment's current configured values, tuned as a starting point rather than a final, audited
          number: see <code>src/billing/quotas.ts</code> in the source.
        </p>
      </section>

      <section class="faq">
        <h2>Frequently asked</h2>
        <div class="faq-list">
          <details open>
            <summary>Do I need a DataForSEO account to self-host?</summary>
            <div class="faq-answer">
              <p>
                Only for the <code>seo</code>/<code>serp</code>/<code>backlinks</code>/<code>ai_visibility</code> tools. The free tier
                (Search Console, GA4, core tools) needs no paid vendor at all.
              </p>
            </div>
          </details>
          <details>
            <summary>Is the cloud version the same code?</summary>
            <div class="faq-answer">
              <p>Yes, the same 18 tools and the same open-source implementation. The cloud version adds hosting, bundled DataForSEO billing, and a dashboard on top.</p>
            </div>
          </details>
          <details>
            <summary>Can I switch from cloud to self-host later?</summary>
            <div class="faq-answer">
              <p>Yes, it's the same MIT-licensed codebase. Clone the repo and deploy your own copy whenever you want.</p>
            </div>
          </details>
          <details>
            <summary>What happens once I use up my plan's included quota?</summary>
            <div class="faq-answer">
              <p>
                Add credit to your prepaid overage wallet from the dashboard, and DataForSEO-backed calls keep working past your monthly quota,
                billed at cost plus a small markup, no plan upgrade needed. It works standalone too: skip the subscription entirely and pay
                straight from the wallet.
              </p>
            </div>
          </details>
        </div>
      </section>
    </>
  );
}

export function renderPricing(canonicalUrl: string, cloudMode: boolean): string {
  return renderPage({
    title: `Pricing · ${DISPLAY_NAME}`,
    description:
      "Free forever to self-host with your own DataForSEO key (zero markup), or hosted cloud plans with bundled DataForSEO access. Compare Free, Pro, and Team.",
    canonicalUrl,
    cloudMode,
    children: <PricingPage cloudMode={cloudMode} />
  });
}
