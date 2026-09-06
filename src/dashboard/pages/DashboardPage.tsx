import { renderPage } from "../Layout";
import { ApiKeysSection } from "../components/ApiKeysSection";
import { BillingSection } from "../components/BillingSection";
import { WebsitesSection } from "../components/WebsitesSection";
import type { DashboardData } from "../types";

function DashboardPage({ data }: { data: DashboardData }) {
  return (
    <>
      <p class="kicker">Cloud</p>
      <h1>Dashboard</h1>
      <WebsitesSection data={data} />
      <BillingSection data={data} />
      <ApiKeysSection data={data} />
    </>
  );
}

export function renderDashboard(data: DashboardData): string {
  return renderPage({ title: "Dashboard", children: <DashboardPage data={data} /> });
}
