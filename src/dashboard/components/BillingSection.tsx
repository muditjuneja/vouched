import { Badge, Button } from "../../design";
import { MONTHLY_QUOTA_USD, PLAN_PRICES_USD, TOPUP_PRESETS_USD } from "../../billing/quotas";
import type { BillingData } from "../types";

function UpgradeForm({
  plan,
  buttonLabel,
  prefillEmail
}: {
  plan: "pro" | "team";
  buttonLabel: string;
  prefillEmail: string | null;
}) {
  return (
    <form method="get" action="/billing/checkout" style="margin: 0; width: 100%;">
      <input type="hidden" name="plan" value={plan} />
      {prefillEmail ? (
        <input type="hidden" name="email" value={prefillEmail} />
      ) : (
        <input type="email" name="email" placeholder="you@example.com" required style="width: 100%; margin-bottom: 0.5rem;" />
      )}
      <Button variant="primary" style="width: 100%; justify-content: center;">
        {buttonLabel}
      </Button>
    </form>
  );
}

function TopupForm({ amountUsd, prefillEmail }: { amountUsd: number; prefillEmail: string | null }) {
  return (
    <form method="get" action="/billing/topup" class="row" style="margin: 0;">
      <input type="hidden" name="amount" value={amountUsd} />
      {prefillEmail ? <input type="hidden" name="email" value={prefillEmail} /> : <input type="email" name="email" placeholder="you@example.com" required />}
      <Button>Add ${amountUsd}</Button>
    </form>
  );
}

export function BillingSection({ data }: { data: BillingData }) {
  const pct = data.quotaUsd > 0 ? Math.min(100, Math.round((data.usageUsd / data.quotaUsd) * 100)) : 0;
  return (
    <section class="panel">
      <h2>Subscription Plans</h2>
      <p class="muted" style="margin-bottom: 1.25rem;">
        Upgrade or change your plan. Bundled plans include monthly DataForSEO quota without needing your own API key.
      </p>

      <div class="tier-grid">
        {/* Free Tier */}
        <div class={`tier-card ${data.plan === "free" ? "active-tier" : ""}`}>
          <div>
            <div class="tier-card-header">
              <span class="tier-title">Free</span>
              <span class="tier-price">$0/mo</span>
            </div>
            <ul class="tier-features">
              <li>Free GSC &amp; GA4 tools</li>
              <li>URL indexing inspection</li>
              <li>Prepaid wallet compatible</li>
              <li>Self-host BYOK support</li>
            </ul>
          </div>
          <div>
            {data.plan === "free" ? (
              <Badge status="good" label="Current Plan" />
            ) : (
              <p class="muted" style="font-size: 0.8rem; margin: 0;">
                Basic access
              </p>
            )}
          </div>
        </div>

        {/* Pro Tier */}
        <div class={`tier-card ${data.plan === "pro" ? "active-tier" : ""}`}>
          <div>
            <div class="tier-card-header">
              <span class="tier-title">Pro</span>
              <span class="tier-price">${PLAN_PRICES_USD.pro}/mo</span>
            </div>
            <ul class="tier-features">
              <li>${MONTHLY_QUOTA_USD.pro}/mo bundled DataForSEO</li>
              <li>All 18 SEO tools included</li>
              <li>60 requests/min rate limit</li>
              <li>Automatic wallet failover</li>
            </ul>
          </div>
          <div>
            {data.plan === "pro" ? (
              <Badge status="good" label="Current Plan" />
            ) : data.dodoConfigured ? (
              <UpgradeForm plan="pro" buttonLabel={`Upgrade to Pro ($${PLAN_PRICES_USD.pro}/mo)`} prefillEmail={data.prefillEmail} />
            ) : (
              <span class="muted">Billing unavailable</span>
            )}
          </div>
        </div>

        {/* Team Tier */}
        <div class={`tier-card ${data.plan === "team" ? "active-tier" : ""}`}>
          <div>
            <div class="tier-card-header">
              <span class="tier-title">Team</span>
              <span class="tier-price">${PLAN_PRICES_USD.team}/mo</span>
            </div>
            <ul class="tier-features">
              <li>${MONTHLY_QUOTA_USD.team}/mo bundled DataForSEO</li>
              <li>Highest rate limits</li>
              <li>Dedicated cloud throughput</li>
              <li>Priority support</li>
            </ul>
          </div>
          <div>
            {data.plan === "team" ? (
              <Badge status="good" label="Current Plan" />
            ) : data.dodoConfigured ? (
              <UpgradeForm plan="team" buttonLabel={`Upgrade to Team ($${PLAN_PRICES_USD.team}/mo)`} prefillEmail={data.prefillEmail} />
            ) : (
              <span class="muted">Billing unavailable</span>
            )}
          </div>
        </div>
      </div>

      {data.hasDodoCustomer ? (
        <p style="margin: 0.5rem 0 1.5rem;">
          <a href="/billing/portal">Manage payment methods, invoices &amp; cancellation in Customer Portal →</a>
        </p>
      ) : null}

      <h2>Quota &amp; Usage</h2>
      {data.plan === "free" ? (
        <p class="muted">
          Free tier includes no bundled DataForSEO quota. Add wallet credits below to unlock keyword, backlink, and SERP tools without an ongoing subscription.
        </p>
      ) : (
        <>
          <p>
            DataForSEO usage this period: <strong>${data.usageUsd.toFixed(2)}</strong> / ${data.quotaUsd.toFixed(2)} ({pct}%)
          </p>
          <div class="meter" aria-hidden="true">
            <span style={`width:${pct}%`} />
          </div>
        </>
      )}

      <h2 style="margin-top: 1.75rem;">Overage Wallet</h2>
      <p>
        Wallet balance: <strong>${data.walletBalanceUsd.toFixed(2)}</strong>
      </p>
      <p class="muted">
        Once your bundled quota runs out, DataForSEO-backed MCP calls continue running seamlessly as long as this balance is positive. Calls are debited at cost plus a 15% fee. Free accounts can also use the wallet to pay as you go.
      </p>
      {data.dodoConfigured ? (
        <div class="row" style="margin-top: 0.75rem;">
          {TOPUP_PRESETS_USD.map((amountUsd) => (
            <TopupForm amountUsd={amountUsd} prefillEmail={data.prefillEmail} />
          ))}
        </div>
      ) : (
        <p class="muted">Billing isn't configured on this deployment yet.</p>
      )}
    </section>
  );
}

