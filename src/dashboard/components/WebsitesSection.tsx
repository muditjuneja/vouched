import { Button, Table } from "../../design";
import type { WebsitesData } from "../types";
import { ConnectionBadge } from "./ConnectionBadge";

function ConnectLink({ scope, show }: { scope: "webmaster_console" | "analytics_property"; show: boolean }) {
  if (!show) return null;
  return (
    <a href={`/oauth/google/start?scope=${scope}&returnTo=websites`} class="btn-connect-link">
      Connect →
    </a>
  );
}

export function WebsitesSection({ data }: { data: WebsitesData }) {
  return (
    <section class="panel">
      {data.websites.length === 0 ? (
        <div class="empty-state-card">
          <p class="muted">No websites tracked yet. Add one to unlock audit/gsc/analytics tools for it.</p>
          <label for="add-website-toggle" class="btn btn-primary" style="cursor: pointer;">
            + Add a website
          </label>
        </div>
      ) : (
        <Table headers={["Site", "Search Console", "Analytics", ""]} class="websites-table">
          {data.websites.map(({ row, gsc, ga4 }) => (
            <tr>
              <td data-label="Site">
                <div style="font-weight: 600;">{row.name}</div>
                <div class="site-domain-row">
                  <span class="site-domain">{row.primary_domain}</span>
                  <button type="button" class="btn-copy-inline" data-copy={row.primary_domain} title="Copy domain">
                    Copy
                  </button>
                </div>
              </td>
              <td data-label="Search Console">
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <ConnectionBadge state={gsc} />
                  <ConnectLink scope="webmaster_console" show={gsc !== "connected" && data.googleOAuthConfigured && Boolean(row.gsc_site_url)} />
                </div>
              </td>
              <td data-label="Analytics">
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <ConnectionBadge state={ga4} />
                  <ConnectLink scope="analytics_property" show={ga4 !== "connected" && data.googleOAuthConfigured && Boolean(row.ga4_property_id)} />
                </div>
              </td>
              <td data-label="Actions" class="col-actions">
                <div class="row-actions">
                  <Button href={`/dashboard/websites/${row.website_id}/edit`} size="sm">
                    Edit
                  </Button>
                  <form
                    method="post"
                    action={`/dashboard/websites/${row.website_id}/delete`}
                    class="inline"
                    onsubmit="return confirm('Delete this website? Its audit/gsc/analytics history stays in the log, but it stops being tracked.')"
                  >
                    <Button size="sm">Delete</Button>
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

