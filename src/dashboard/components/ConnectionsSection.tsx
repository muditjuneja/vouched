import { Button, Table } from "../../design";
import type { SettingsData } from "../types";
import { ConnectionBadge } from "./ConnectionBadge";

function ConnectionRow({
  label,
  scope,
  state,
  googleOAuthConfigured
}: {
  label: string;
  scope: "webmaster_console" | "analytics_property";
  state: SettingsData["gsc"];
  googleOAuthConfigured: boolean;
}) {
  return (
    <tr>
      <td data-label="Service">{label}</td>
      <td data-label="Status">
        <ConnectionBadge state={state} />
      </td>
      <td data-label="Action">
        {!googleOAuthConfigured ? null : state === "not_connected" ? (
          <a href={`/oauth/google/start?scope=${scope}`}>Connect</a>
        ) : (
          <form
            method="post"
            action={`/dashboard/google/${scope}/disconnect`}
            class="inline"
            onsubmit="return confirm('Disconnect this Google account? Tools relying on it will stop working for every website until you reconnect.')"
          >
            <Button>Disconnect</Button>
          </form>
        )}
      </td>
    </tr>
  );
}

export function ConnectionsSection({ data }: { data: SettingsData }) {
  return (
    <section class="panel">
      <h2>Google connections</h2>
      {data.googleOAuthConfigured ? (
        <>
          <p class="muted">One Google account per service, shared across every website you track. Reconnecting replaces the previous one.</p>
          <Table headers={["Service", "Status", ""]}>
            <ConnectionRow label="Search Console" scope="webmaster_console" state={data.gsc} googleOAuthConfigured={data.googleOAuthConfigured} />
            <ConnectionRow label="Analytics" scope="analytics_property" state={data.ga4} googleOAuthConfigured={data.googleOAuthConfigured} />
          </Table>
        </>
      ) : (
        <p class="muted">Google OAuth isn't configured on this deployment yet.</p>
      )}
    </section>
  );
}
