import { renderPage } from "../Layout";
import { AddWebsiteWidget } from "../components/AddWebsiteWidget";
import { WebsitesSection } from "../components/WebsitesSection";
import type { WebsitesData } from "../types";

function WebsitesPage({ data }: { data: WebsitesData }) {
  return (
    <>
      <div class="page-header-row">
        <h1>Websites</h1>
        <AddWebsiteWidget data={data} />
      </div>
      <WebsitesSection data={data} />
    </>
  );
}

export function renderWebsites(data: WebsitesData): string {
  return renderPage({
    title: "Websites",
    activePath: "/dashboard/websites",
    user: data.user,
    notice: data.notice,
    children: <WebsitesPage data={data} />
  });
}

