import { StatCard, Table } from "../../design";
import { renderPage } from "../Layout";
import { PaymentStatusBanner } from "../components/PaymentStatusBanner";
import type { OverviewData } from "../types";

function OverviewPage({ data }: { data: OverviewData }) {
  return (
    <>
      <p class="kicker">Cloud</p>
      <h1>Overview</h1>
      <PaymentStatusBanner status={data.status} currentPeriodEnd={data.currentPeriodEnd} />
      <div class="stat-grid">
        <StatCard label="Plan" value={data.plan} />
        <StatCard
          label="Usage this period"
          value={`$${data.usageUsd.toFixed(2)} / $${data.quotaUsd.toFixed(2)}`}
          status={data.quotaUsd > 0 && data.usageUsd >= data.quotaUsd ? "warn" : undefined}
        />
        <StatCard label="Wallet balance" value={`$${data.walletBalanceUsd.toFixed(2)}`} />
        <StatCard label="Websites tracked" value={String(data.websiteCount)} />
      </div>

      <section class="panel">
        <h2>Recent activity</h2>
        {data.recentActivity.length === 0 ? (
          <p class="muted">No activity yet. Calls through the seo/serp/backlinks/ai_visibility tools will show up here.</p>
        ) : (
          <>
            <Table headers={["Called at", "Tool", "Cost"]}>
              {data.recentActivity.map((row) => (
                <tr>
                  <td data-label="Called at">{row.called_at}</td>
                  <td data-label="Tool">{row.tool_name}</td>
                  <td data-label="Cost">${row.cost_usd.toFixed(4)}</td>
                </tr>
              ))}
            </Table>
            <p style="margin-top:0.75rem">
              <a href="/dashboard/usage">View all →</a>
            </p>
          </>
        )}
      </section>
    </>
  );
}

export function renderOverview(data: OverviewData): string {
  return renderPage({ title: "Overview", activePath: "/dashboard", children: <OverviewPage data={data} /> });
}
