import { Pagination, StatCard, Table } from "../../design";
import { renderPage } from "../Layout";
import type { UsageData } from "../types";

function UsagePage({ data }: { data: UsageData }) {
  const showStats = data.totalCalls !== undefined;

  return (
    <>
      <h1>Usage</h1>
      <p class="muted">Every DataForSEO-backed call this account has made, most recent first.</p>

      {showStats ? (
        <div class="stat-grid" style="margin-bottom: 1.5rem;">
          <StatCard label="Total calls recorded" value={String(data.totalCalls ?? data.rows.length)} />
          <StatCard label="Monthly data spend" value={`$${(data.periodSpendUsd ?? 0).toFixed(2)}`} />
          <StatCard label="Plan monthly quota" value={`$${(data.quotaUsd ?? 0).toFixed(2)}`} />
        </div>
      ) : null}

      <section class="panel">
        <h2>Activity Log</h2>
        {data.rows.length === 0 ? (
          <p class="muted">No usage yet. Calls through the seo/serp/backlinks/ai_visibility tools will show up here.</p>
        ) : (
          <>
            <Table headers={["Called at", "Tool", "Endpoint", "Cost"]} class="table-usage">
              {data.rows.map((row) => (
                <tr>
                  <td data-label="Called at">{row.called_at}</td>
                  <td data-label="Tool">
                    <strong>{row.tool_name}</strong>
                  </td>
                  <td class="muted" data-label="Endpoint" style="font-family: var(--font-mono); font-size: 0.8rem;">
                    {row.endpoint}
                  </td>
                  <td data-label="Cost" class="text-right">${row.cost_usd.toFixed(4)}</td>
                </tr>
              ))}
            </Table>
            <Pagination nextHref={data.nextBeforeId !== null ? `/dashboard/usage?before=${data.nextBeforeId}` : null} />
          </>
        )}
      </section>
    </>
  );
}

export function renderUsage(data: UsageData): string {
  return renderPage({ title: "Usage", activePath: "/dashboard/usage", user: data.user, children: <UsagePage data={data} /> });
}

