import { Card, Table } from "../../design";
import { MONTHLY_QUOTA_USD } from "../../billing/quotas";
import { TOOL_MANIFEST } from "../../mcp/manifest";
import { Hero } from "../components/Hero";
import { PricingCard } from "../components/PricingCard";
import { GITHUB_URL } from "../github-url";
import { renderPage } from "../Layout";

function PricingPage() {
  return (
    <>
      <Hero eyebrow="Pricing" heading="Free to self-host. Pay for convenience, not for the data." lede="Every plan gets the same 18 tools. What changes is who runs the server and who holds the DataForSEO account." />

      <section class="pricing-grid">
        <PricingCard name="Free (self-host)" price="$0" priceNote="/mo, forever" ctaLabel="Self-host it" ctaHref={GITHUB_URL} primaryCta>
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

        <PricingCard name="Pro (cloud)" price={`$${MONTHLY_QUOTA_USD.pro}`} priceNote="/mo, included usage" ctaLabel="Start on Pro" ctaHref="/dashboard" featured primaryCta>
          <p>
            Hosted for you. Bundled DataForSEO access — no API key to manage — with ${MONTHLY_QUOTA_USD.pro}/mo of underlying DataForSEO
            cost included before you'd need to talk to us about more.
          </p>
          <ul>
            <li>Everything in Free</li>
            <li>No DataForSEO account needed</li>
            <li>Dashboard: connection status, usage, API keys</li>
            <li>MCP API key management (create / revoke)</li>
          </ul>
        </PricingCard>

        <PricingCard name="Team (cloud)" price={`$${MONTHLY_QUOTA_USD.team}`} priceNote="/mo, included usage" ctaLabel="Start on Team" ctaHref="/dashboard">
          <p>
            Same hosted product as Pro, with a larger bundled DataForSEO allowance — ${MONTHLY_QUOTA_USD.team}/mo of underlying cost
            included — for teams tracking more sites or running more research per month.
          </p>
          <ul>
            <li>Everything in Pro</li>
            <li>Higher bundled DataForSEO quota</li>
            <li>Same per-tenant dashboard and key management</li>
          </ul>
        </PricingCard>
      </section>

      <section>
        <h2>Full comparison</h2>
        <Table class="compare" headers={["Feature", "Free (self-host)", "Pro (cloud)", "Team (cloud)"]}>
          <tr>
            <td>Who runs the server</td>
            <td>You</td>
            <td>Us</td>
            <td>Us</td>
          </tr>
          <tr>
            <td>All 18 MCP tools</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Free-tier tools (core/audit/gsc/analytics)</td>
            <td>Yes, no paid vendor</td>
            <td>Yes</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>DataForSEO access</td>
            <td>Bring your own key, billed by DataForSEO directly</td>
            <td>Bundled, ${MONTHLY_QUOTA_USD.pro}/mo included</td>
            <td>Bundled, ${MONTHLY_QUOTA_USD.team}/mo included</td>
          </tr>
          <tr>
            <td>Dashboard (sites, usage, API keys)</td>
            <td>— (self-managed)</td>
            <td>Yes</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Source code</td>
            <td colspan={3}>MIT licensed for everyone, on every plan</td>
          </tr>
        </Table>
        <p class="muted">
          Cloud quota amounts are the deployment's current configured values, tuned as a starting point rather than a final, audited
          number — see <code>src/billing/quotas.ts</code> in the source.
        </p>
      </section>

      <section>
        <h2>Frequently asked</h2>
        <div class="grid">
          <Card title="Do I need a DataForSEO account to self-host?">
            <p>
              Only for the <code>seo</code>/<code>serp</code>/<code>backlinks</code>/<code>ai_visibility</code> tools. The free tier —
              audits, Search Console, GA4 — needs no paid vendor at all.
            </p>
          </Card>
          <Card title="Is the cloud version the same code?">
            <p>Yes — same 18 tools, same open-source implementation. The cloud version adds hosting, bundled DataForSEO billing, and a dashboard on top.</p>
          </Card>
          <Card title="Can I switch from cloud to self-host later?">
            <p>Yes — it's the same MIT-licensed codebase. Clone the repo and deploy your own copy whenever you want.</p>
          </Card>
        </div>
      </section>
    </>
  );
}

export function renderPricing(canonicalUrl: string): string {
  return renderPage({
    title: "Pricing — mcp-seo-toolkit",
    description:
      "Free forever to self-host with your own DataForSEO key (zero markup), or hosted cloud plans with bundled DataForSEO access. Compare Free, Pro, and Team.",
    canonicalUrl,
    children: <PricingPage />
  });
}
