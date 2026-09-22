import { Button, Table } from "../../design";
import type { WebsitesData } from "../types";
import { ConnectionBadge } from "./ConnectionBadge";

function ConnectLink({ scope, show }: { scope: "webmaster_console" | "analytics_property"; show: boolean }) {
  if (!show) return null;
  return <a href={`/oauth/google/start?scope=${scope}&returnTo=websites`}> connect</a>;
}

export function WebsitesSection({ data }: { data: WebsitesData }) {
  return (
    <section class="panel">
      {data.websites.length === 0 ? (
        <p class="muted">No websites tracked yet. Add one below to unlock audit/gsc/analytics tools for it.</p>
      ) : (
        <Table headers={["Site", "Search Console", "Analytics", ""]}>
          {data.websites.map(({ row, gsc, ga4 }) => (
            <tr>
              <td data-label="Site">
                {row.name}
                <div class="muted">{row.primary_domain}</div>
              </td>
              <td data-label="Search Console">
                <ConnectionBadge state={gsc} />
                <ConnectLink scope="webmaster_console" show={gsc !== "connected" && data.googleOAuthConfigured && Boolean(row.gsc_site_url)} />
              </td>
              <td data-label="Analytics">
                <ConnectionBadge state={ga4} />
                <ConnectLink scope="analytics_property" show={ga4 !== "connected" && data.googleOAuthConfigured && Boolean(row.ga4_property_id)} />
              </td>
              <td data-label="Actions">
                <div class="row">
                  <Button href={`/dashboard/websites/${row.website_id}/edit`}>Edit</Button>
                  <form
                    method="post"
                    action={`/dashboard/websites/${row.website_id}/delete`}
                    class="inline"
                    onsubmit="return confirm('Delete this website? Its audit/gsc/analytics history stays in the log, but it stops being tracked.')"
                  >
                    <Button>Delete</Button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
