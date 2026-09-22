import { Button, Callout, Table } from "../../design";
import type { WebsitesData } from "../types";
import { ConnectionBadge } from "./ConnectionBadge";
import { Ga4PropertyField, GscSiteField } from "./GoogleAssetFields";

function ConnectLink({ scope, show }: { scope: "webmaster_console" | "analytics_property"; show: boolean }) {
  if (!show) return null;
  return <a href={`/oauth/google/start?scope=${scope}`}> connect</a>;
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
      {data.googleOAuthConfigured && (data.gscSites === null || data.ga4Properties === null) ? (
        <Callout>
          <p>
            Connect Google in <a href="/dashboard/settings">Settings</a> to pick your Search Console/Analytics properties from a real
            list instead of typing an id by hand.
          </p>
        </Callout>
      ) : null}
      <form method="post" action="/dashboard/websites" class="row" style="margin-top:0.75rem">
        <input name="name" placeholder="Display name" required />
        <input name="primaryDomain" placeholder="example.com" required />
        <GscSiteField sites={data.gscSites} />
        <Ga4PropertyField properties={data.ga4Properties} />
        <button type="submit" class="btn btn-primary">
          Add website
        </button>
      </form>
    </section>
  );
}
