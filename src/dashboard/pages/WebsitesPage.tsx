import { renderPage } from "../Layout";
import { WebsitesSection } from "../components/WebsitesSection";
import type { WebsitesData } from "../types";

function WebsitesPage({ data }: { data: WebsitesData }) {
  return (
    <>
      <h1>Websites</h1>
      <WebsitesSection data={data} />
    </>
  );
}

export function renderWebsites(data: WebsitesData): string {
  return renderPage({ title: "Websites", activePath: "/dashboard/websites", children: <WebsitesPage data={data} /> });
}
