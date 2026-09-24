import { Badge, Button } from "../../design";
import { FREE_DAILY_TOOL_CALLS, MONTHLY_QUOTA_USD, PLAN_PRICES_USD, TEAM_SEATS, TOPUP_PRESETS_USD } from "../../billing/quotas";
import type { Plan } from "../../db/subscriptions";
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

/**
 * Every line here is something the code actually enforces (see
 * src/billing/quotas.ts and wrangler.jsonc's ratelimits): no feature is
 * listed that doesn't exist.
 */
const TIER_FEATURES: Record<Plan, string[]> = {
  free: [
    "Your own Search Console & Analytics data",
    "URL indexing inspection and sitemaps",
    `${FREE_DAILY_TOOL_CALLS} tool calls/day, 10/min`,
    "No paid market data"
  ],
  pro: [
    "Everything in Free, no daily cap",
    "Keywords, backlinks, SERPs & AI visibility",
    `$${MONTHLY_QUOTA_USD.pro}/mo of market data included`,
    "Overage from a prepaid wallet, 60 requests/min"
  ],
  team: [
    `Everything in Pro, for up to ${TEAM_SEATS} people`,
    `$${MONTHLY_QUOTA_USD.team}/mo of market data included`,
    "Shared websites & Google connections",
    "Each member gets their own API keys"
  ]
};

function TierCard({ tier, data }: { tier: Plan; data: BillingData }) {
  const title = tier === "free" ? "Free" : tier === "pro" ? "Pro" : "Team";
  const current = data.plan === tier;
  return (
    <div class={`tier-card ${current ? "active-tier" : ""}`}>
      <div>
        <div class="tier-card-header">
          <span class="tier-title">{title}</span>
          <span class="tier-price">${PLAN_PRICES_USD[tier]}/mo</span>
        </div>
        <ul class="tier-features">
          {TIER_FEATURES[tier].map((feature) => (
            <li>{feature}</li>
          ))}
        </ul>
      </div>
      <div>
        {current ? (
          <Badge status="good" label="Current Plan" />
        ) : tier === "free" ? null : !data.canManageBilling ? (
          <span class="muted">Managed by the workspace owner</span>
        ) : data.dodoConfigured ? (
          <UpgradeForm plan={tier} buttonLabel={`Upgrade to ${title} ($${PLAN_PRICES_USD[tier]}/mo)`} prefillEmail={data.prefillEmail} />
        ) : (
          <span class="muted">Billing unavailable</span>
        )}
      </div>
    </div>
  );
}

export function BillingSection({ data }: { data: BillingData }) {
  const pct = data.quotaUsd > 0 ? Math.min(100, Math.round((data.usageUsd / data.quotaUsd) * 100)) : 0;
  return (
    <section class="panel">
      <h2>Subscription Plans</h2>
      {data.canManageBilling ? (
        <p class="muted" style="margin-bottom: 1.25rem;">
          Free covers your own Google data. Pro and Team add paid market data, with a monthly amount included.
        </p>
      ) : (
        <p class="muted" style="margin-bottom: 1.25rem;">
          You're a member of this team. Only the workspace owner can change the plan or add wallet credit.
        </p>
      )}

      <div class="tier-grid">
        <TierCard tier="free" data={data} />
        <TierCard tier="pro" data={data} />
        <TierCard tier="team" data={data} />
      </div>

      {data.canManageBilling && data.hasDodoCustomer ? (
        <p style="margin: 0.5rem 0 1.5rem;">
          <a href="/billing/portal">Manage payment methods, invoices &amp; cancellation in Customer Portal →</a>
        </p>
      ) : null}

      <h2>Quota &amp; Usage</h2>
      {data.plan === "free" ? (
        <p class="muted">The free plan doesn't include paid market data. Upgrade to Pro or Team to use keyword, backlink and SERP tools.</p>
      ) : (
        <>
          <p>
            Market data used this period: <strong>${data.usageUsd.toFixed(2)}</strong> / ${data.quotaUsd.toFixed(2)} ({pct}%)
          </p>
          <div class="meter" aria-hidden="true">
            <span style={`width:${pct}%`} />
          </div>
        </>
      )}

      <h2 style="margin-top: 1.75rem;">Overage Wallet</h2>
      {data.plan === "free" ? (
        <>
          {data.walletBalanceUsd > 0 ? (
            <p>
              Wallet balance: <strong>${data.walletBalanceUsd.toFixed(2)}</strong> (kept for when you resubscribe)
            </p>
          ) : null}
          <p class="muted">The wallet pays for market data beyond your plan's included amount, so it's available on Pro and Team.</p>
        </>
      ) : (
        <>
          <p>
            Wallet balance: <strong>${data.walletBalanceUsd.toFixed(2)}</strong>
          </p>
          <p class="muted">
            Once your included amount runs out, market-data calls keep working while this balance is positive, charged at cost plus 15%.
          </p>
          {!data.canManageBilling ? null : data.dodoConfigured ? (
            <div class="row" style="margin-top: 0.75rem;">
              {TOPUP_PRESETS_USD.map((amountUsd) => (
                <TopupForm amountUsd={amountUsd} prefillEmail={data.prefillEmail} />
              ))}
            </div>
          ) : (
            <p class="muted">Billing isn't configured on this deployment yet.</p>
          )}
        </>
      )}
    </section>
  );
}
