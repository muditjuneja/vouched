import { Callout } from "../../design";
import { renderPage } from "../Layout";
import { ConnectionsSection } from "../components/ConnectionsSection";
import { TeamSection } from "../components/TeamSection";
import type { SettingsData } from "../types";

const SCOPE_LABEL = { webmaster_console: "Search Console", analytics_property: "Analytics" } as const;

function SettingsPage({ data }: { data: SettingsData }) {
  return (
    <>
      <h1>Settings</h1>
      {data.justConnected ? (
        <Callout>
          <p>{SCOPE_LABEL[data.justConnected]} connected.</p>
        </Callout>
      ) : null}
      <section class="panel">
        <h2>Account &amp; Session</h2>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <p style="margin: 0;">
            Signed in as: <strong>{data.email ?? "unknown"}</strong>
          </p>
          {data.tenantId ? (
            <div class="row" style="align-items: center; gap: 0.5rem;">
              <span class="muted" style="font-size: 0.85rem;">Tenant ID:</span>
              <code style="font-size: 0.82rem;">{data.tenantId}</code>
              <button type="button" class="btn btn-sm btn-copy" data-copy={data.tenantId}>
                Copy ID
              </button>
            </div>
          ) : null}
          <div style="margin-top: 0.5rem; padding-top: 0.75rem; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
            <span class="muted" style="font-size: 0.85rem;">Sign out of this session:</span>
            <a href="/dashboard/logout" class="btn btn-sm" style="color: var(--status-warn-bg); border-color: var(--status-warn-bg);">
              Sign out →
            </a>
          </div>
        </div>
      </section>
      {data.team ? <TeamSection team={data.team} /> : null}
      <ConnectionsSection data={data} />
    </>
  );
}

export function renderSettings(data: SettingsData): string {
  return renderPage({
    title: "Settings",
    activePath: "/dashboard/settings",
    user: data.user,
    notice: data.notice,
    children: <SettingsPage data={data} />
  });
}

