import { renderPage } from "../Layout";
import { ApiKeysSection } from "../components/ApiKeysSection";
import { ConnectionsSection } from "../components/ConnectionsSection";
import type { SettingsData } from "../types";

function SettingsPage({ data }: { data: SettingsData }) {
  return (
    <>
      <h1>Settings</h1>
      <section class="panel">
        <h2>Account</h2>
        <p>
          Signed in as: <strong>{data.email ?? "unknown"}</strong>
        </p>
      </section>
      <ConnectionsSection data={data} />
      <ApiKeysSection data={data} />
    </>
  );
}

export function renderSettings(data: SettingsData): string {
  return renderPage({ title: "Settings", activePath: "/dashboard/settings", children: <SettingsPage data={data} /> });
}
