import { StatCard, Table } from "../../design";
import { renderPage } from "../Layout";
import { PaymentStatusBanner } from "../components/PaymentStatusBanner";
import type { OverviewData } from "../types";

function OverviewPage({ data }: { data: OverviewData }) {
  const mcpUrl = data.workerOrigin ? `${data.workerOrigin}/mcp` : "/mcp";

  return (
    <>
      <h1>Overview</h1>
      <PaymentStatusBanner status={data.status} currentPeriodEnd={data.currentPeriodEnd} />

      {data.workerOrigin ? (
        <div class="quick-connect-banner">
          <div class="quick-connect-header">
            <div>
              <h2>MCP Server Endpoint</h2>
              <p class="muted" style="margin: 0.2rem 0 0; font-size: 0.85rem;">
                Connect this server to Claude Desktop, Cursor, or Claude Code to run SEO commands.
              </p>
            </div>
            <div>
              {data.hasApiKeys ? (
                <span class="badge badge-good">API key active</span>
              ) : (
                <a href="/dashboard/settings" class="btn btn-sm btn-primary">
                  + Create API key
                </a>
              )}
            </div>
          </div>
          <div class="quick-connect-endpoint">
            <span class="quick-connect-url">{mcpUrl}</span>
            <button type="button" class="btn btn-sm btn-copy" data-copy={mcpUrl}>
              Copy URL
            </button>
          </div>
        </div>
      ) : null}

      <div class="stat-grid">
        <StatCard label="Plan" value={data.plan} sublabel={data.currentPeriodEnd ? `Renews ${data.currentPeriodEnd.slice(0, 10)}` : undefined} />
        <StatCard
          label="Usage this period"
          value={`$${data.usageUsd.toFixed(2)} / $${data.quotaUsd.toFixed(2)}`}
          status={data.quotaUsd > 0 && data.usageUsd >= data.quotaUsd ? "warn" : undefined}
          sublabel="Included DataForSEO data"
        />
        <StatCard label="Wallet balance" value={`$${data.walletBalanceUsd.toFixed(2)}`} sublabel="Funds overage calls" />
        <StatCard label="Websites tracked" value={String(data.websiteCount)} sublabel="Search Console & GA4" />
      </div>

      <section class="panel">
        <h2>Recent activity</h2>
        {data.recentActivity.length === 0 ? (
          <p class="muted">No activity yet. Calls through the seo/serp/backlinks/ai_visibility tools will show up here.</p>
        ) : (
          <>
            <Table headers={["Called at", "Tool", "Cost"]} class="table-activity">
              {data.recentActivity.map((row) => (
                <tr>
                  <td data-label="Called at">{row.called_at}</td>
                  <td data-label="Tool">{row.tool_name}</td>
                  <td data-label="Cost" class="text-right">${row.cost_usd.toFixed(4)}</td>
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
  return renderPage({ title: "Overview", activePath: "/dashboard", user: data.user, notice: data.notice, children: <OverviewPage data={data} /> });
}

