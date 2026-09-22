import { Pagination, Table } from "../../design";
import { renderPage } from "../Layout";
import type { UsageData } from "../types";

function UsagePage({ data }: { data: UsageData }) {
  return (
    <>
      <h1>Usage</h1>
      <p class="muted">Every DataForSEO-backed call this account has made, most recent first.</p>
      {data.rows.length === 0 ? (
        <p class="muted">No usage yet. Calls through the seo/serp/backlinks/ai_visibility tools will show up here.</p>
      ) : (
        <>
          <Table headers={["Called at", "Tool", "Endpoint", "Cost"]}>
            {data.rows.map((row) => (
              <tr>
                <td data-label="Called at">{row.called_at}</td>
                <td data-label="Tool">{row.tool_name}</td>
                <td class="muted" data-label="Endpoint">
                  {row.endpoint}
                </td>
                <td data-label="Cost">${row.cost_usd.toFixed(4)}</td>
              </tr>
            ))}
          </Table>
          <Pagination nextHref={data.nextBeforeId !== null ? `/dashboard/usage?before=${data.nextBeforeId}` : null} />
        </>
      )}
    </>
  );
}

export function renderUsage(data: UsageData): string {
  return renderPage({ title: "Usage", activePath: "/dashboard/usage", children: <UsagePage data={data} /> });
}
