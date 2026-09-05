import { Button } from "../../design";
import { MONTHLY_QUOTA_USD } from "../../billing/quotas";
import type { DashboardData } from "../types";

function UpgradeForm({ plan, priceUsd }: { plan: "pro" | "team"; priceUsd: number }) {
  return (
    <form method="get" action="/billing/checkout" class="row" style="margin-top:0.5rem">
      <input type="hidden" name="plan" value={plan} />
      <input type="email" name="email" placeholder="you@example.com" required />
      <Button variant="primary">
        Upgrade to {plan === "pro" ? "Pro" : "Team"} (${priceUsd}/mo included usage)
      </Button>
    </form>
  );
}

export function BillingSection({ data }: { data: DashboardData }) {
  const pct = data.quotaUsd > 0 ? Math.min(100, Math.round((data.usageUsd / data.quotaUsd) * 100)) : 0;
  return (
    <section>
      <h2>Plan &amp; usage</h2>
      <p>
        Current plan: <strong>{data.plan}</strong>
      </p>
      {data.plan === "free" ? (
        <p class="muted">Free doesn't include bundled DataForSEO access. Self-host with your own key, or upgrade below.</p>
      ) : (
        <p>
          DataForSEO usage this period: ${data.usageUsd.toFixed(2)} / ${data.quotaUsd.toFixed(2)} ({pct}%)
        </p>
      )}
      {data.dodoConfigured ? (
        <>
          <UpgradeForm plan="pro" priceUsd={MONTHLY_QUOTA_USD.pro} />
          <UpgradeForm plan="team" priceUsd={MONTHLY_QUOTA_USD.team} />
        </>
      ) : (
        <p class="muted">Billing isn't configured on this deployment yet.</p>
      )}
    </section>
  );
}
