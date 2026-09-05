import { Table } from "../../design";
import type { DashboardData } from "../types";
import { ConnectionBadge } from "./ConnectionBadge";

function ConnectLink({ scope, show }: { scope: "webmaster_console" | "analytics_property"; show: boolean }) {
  if (!show) return null;
  return <a href={`/oauth/google/start?scope=${scope}`}> connect</a>;
}

export function WebsitesSection({ data }: { data: DashboardData }) {
  return (
    <section>
      <h2>Websites</h2>
      {data.websites.length === 0 ? (
        <p class="muted">No websites tracked yet. Add one below to unlock audit/gsc/analytics tools for it.</p>
      ) : (
        <Table headers={["Site", "Search Console", "Analytics"]}>
          {data.websites.map(({ row, gsc, ga4 }) => (
            <tr>
              <td>
                {row.name}
                <div class="muted">{row.primary_domain}</div>
              </td>
              <td>
                <ConnectionBadge state={gsc} />
                <ConnectLink scope="webmaster_console" show={gsc !== "connected" && data.googleOAuthConfigured && Boolean(row.gsc_site_url)} />
              </td>
              <td>
                <ConnectionBadge state={ga4} />
                <ConnectLink scope="analytics_property" show={ga4 !== "connected" && data.googleOAuthConfigured && Boolean(row.ga4_property_id)} />
              </td>
            </tr>
          ))}
        </Table>
      )}
      <form method="post" action="/dashboard/websites" class="row" style="margin-top:0.75rem">
        <input name="name" placeholder="Display name" required />
        <input name="primaryDomain" placeholder="example.com" required />
        <input name="gscSiteUrl" placeholder="sc-domain:example.com (optional)" />
        <input name="ga4PropertyId" placeholder="properties/123456789 (optional)" />
        <button type="submit" class="btn btn-primary">
          Add website
        </button>
      </form>
    </section>
  );
}
