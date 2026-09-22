import { Button } from "../../design";
import { MONTHLY_QUOTA_USD, TOPUP_PRESETS_USD } from "../../billing/quotas";
import type { BillingData } from "../types";

function UpgradeForm({ plan, priceUsd, prefillEmail }: { plan: "pro" | "team"; priceUsd: number; prefillEmail: string | null }) {
  return (
    <form method="get" action="/billing/checkout" class="row" style="margin-top:0.5rem">
      <input type="hidden" name="plan" value={plan} />
      {prefillEmail ? <input type="hidden" name="email" value={prefillEmail} /> : <input type="email" name="email" placeholder="you@example.com" required />}
      <Button variant="primary">
        Upgrade to {plan === "pro" ? "Pro" : "Team"} (${priceUsd}/mo included usage)
      </Button>
    </form>
  );
}

function TopupForm({ amountUsd, prefillEmail }: { amountUsd: number; prefillEmail: string | null }) {
  return (
    <form method="get" action="/billing/topup" class="row" style="margin-top:0.5rem">
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
      <h2>Plan &amp; usage</h2>
      <p>
        Current plan: <strong>{data.plan}</strong>
      </p>
      {data.plan === "free" ? (
        <p class="muted">Free doesn't include bundled DataForSEO access. Self-host with your own key, upgrade below, or pay straight from a prepaid wallet.</p>
      ) : (
        <>
          <p>
            DataForSEO usage this period: ${data.usageUsd.toFixed(2)} / ${data.quotaUsd.toFixed(2)} ({pct}%)
          </p>
          <div class="meter" aria-hidden="true">
            <span style={`width:${pct}%`} />
          </div>
        </>
      )}
      {data.dodoConfigured ? (
        <>
          {data.plan === "free" ? <UpgradeForm plan="pro" priceUsd={MONTHLY_QUOTA_USD.pro} prefillEmail={data.prefillEmail} /> : null}
          {data.plan !== "team" ? <UpgradeForm plan="team" priceUsd={MONTHLY_QUOTA_USD.team} prefillEmail={data.prefillEmail} /> : null}
          {data.hasDodoCustomer ? (
            <p style="margin-top:0.75rem">
              <a href="/billing/portal">Manage billing (payment method, invoices, cancel) →</a>
            </p>
          ) : null}
        </>
      ) : (
        <p class="muted">Billing isn't configured on this deployment yet.</p>
      )}

      <h2>Overage wallet</h2>
      <p>
        Wallet balance: <strong>${data.walletBalanceUsd.toFixed(2)}</strong>
      </p>
      <p class="muted">
        Once your plan's bundled quota runs out for the month, DataForSEO-backed calls keep working as long as this balance is positive, billed at
        cost plus a small markup, no plan upgrade needed. Works even on the free plan: buy credits here and skip the subscription entirely.
      </p>
      {data.dodoConfigured ? (
        <div class="row">
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
