import { Button, Table } from "../../design";
import type { WebsitesData } from "../types";
import { ConnectionBadge } from "./ConnectionBadge";
import { Ga4PropertyField, GscSiteField } from "./GoogleAssetFields";

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
        <>
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
                    <label for={`edit-website-${row.website_id}`} class="btn btn-sm drawer-open-btn">
                      Edit
                    </label>
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

          {data.websites.map(({ row }) => {
            const toggleId = `edit-website-${row.website_id}`;
            return (
              <div class="drawer-wrapper" key={toggleId}>
                <input
                  type="checkbox"
                  id={toggleId}
                  class="drawer-toggle-input"
                  checked={data.editingWebsiteId === row.website_id}
                />
                <label for={toggleId} class="drawer-backdrop" aria-hidden="true" />
                <aside class="widget panel slide-drawer edit-website-drawer" aria-label={`Edit ${row.name}`}>
                  <div class="drawer-header">
                    <div>
                      <h2>Edit website</h2>
                      <p class="muted drawer-subtitle">Update display name, domain, or linked Google properties.</p>
                    </div>
                    <label for={toggleId} class="drawer-close" aria-label="Close">
                      ✕
                    </label>
                  </div>
                  <form method="post" action={`/dashboard/websites/${row.website_id}/update`} class="drawer-form">
                    <div class="form-group">
                      <label for={`edit-name-${row.website_id}`} class="form-label">
                        Display name
                      </label>
                      <input
                        id={`edit-name-${row.website_id}`}
                        name="name"
                        value={row.name}
                        required
                        class="form-input"
                      />
                    </div>
                    <div class="form-group">
                      <label for={`edit-domain-${row.website_id}`} class="form-label">
                        Domain
                      </label>
                      <input
                        id={`edit-domain-${row.website_id}`}
                        name="primaryDomain"
                        value={row.primary_domain}
                        required
                        class="form-input"
                      />
                    </div>
                    <div class="form-group">
                      <label class="form-label">
                        Search Console property <span class="muted font-normal">(optional)</span>
                      </label>
                      <GscSiteField sites={data.gscSites ?? null} value={row.gsc_site_url} />
                    </div>
                    <div class="form-group">
                      <label class="form-label">
                        Analytics property <span class="muted font-normal">(optional)</span>
                      </label>
                      <Ga4PropertyField properties={data.ga4Properties ?? null} value={row.ga4_property_id} />
                    </div>
                    <div class="drawer-actions">
                      <button type="submit" class="btn btn-primary btn-sm">
                        Save changes
                      </button>
                      <label for={toggleId} class="btn btn-sm drawer-cancel-btn">
                        Cancel
                      </label>
                    </div>
                  </form>
                </aside>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

