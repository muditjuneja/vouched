import { Button } from "../../design";
import type { GA4Property } from "../../clients/google/analytics-ga4";
import type { SearchConsoleSite } from "../../clients/google/search-console";
import type { WebsiteRow } from "../../db/websites";
import { renderPage } from "../Layout";
import { Ga4PropertyField, GscSiteField } from "../components/GoogleAssetFields";

export interface WebsiteEditData {
  user?: import("../types").DashboardUser;
  website: WebsiteRow;
  gscSites: SearchConsoleSite[] | null;
  ga4Properties: GA4Property[] | null;
}

function WebsiteEditPage({ data }: { data: WebsiteEditData }) {
  const { website, gscSites, ga4Properties } = data;
  return (
    <>
      <h1>Edit website</h1>
      <form method="post" action={`/dashboard/websites/${website.website_id}/update`}>
        <p>
          <label>
            Display name
            <br />
            <input name="name" value={website.name} required />
          </label>
        </p>
        <p>
          <label>
            Domain
            <br />
            <input name="primaryDomain" value={website.primary_domain} required />
          </label>
        </p>
        <p>
          <label>
            Search Console property (optional)
            <br />
            <GscSiteField sites={gscSites} value={website.gsc_site_url} />
          </label>
        </p>
        <p>
          <label>
            Analytics property (optional)
            <br />
            <Ga4PropertyField properties={ga4Properties} value={website.ga4_property_id} />
          </label>
        </p>
        <p class="row">
          <Button variant="primary" type="submit">
            Save changes
          </Button>
          <Button href="/dashboard/websites">Cancel</Button>
        </p>
      </form>
    </>
  );
}

export function renderWebsiteEdit(data: WebsiteEditData): string {
  return renderPage({
    title: `Edit ${data.website.name}`,
    activePath: "/dashboard/websites",
    user: data.user,
    breadcrumbs: [{ label: "Websites", href: "/dashboard/websites" }, { label: `Edit ${data.website.name}` }],
    children: <WebsiteEditPage data={data} />
  });
}

