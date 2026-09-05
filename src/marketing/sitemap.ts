import { COMPARISON_PAGES } from "./content/comparisons";
import { INDUSTRY_PAGES } from "./content/industries";
import { TOOL_PAGES } from "./content/tool-pages";

/**
 * Every real, crawlable marketing route, derived from the same content
 * data the pages themselves render from, so the sitemap can never list a
 * page that doesn't exist or omit one that does. Static routes are the
 * only hand-maintained part; everything generated from `TOOL_MANIFEST`
 * (via `TOOL_PAGES`) grows and shrinks with the manifest automatically.
 */
export function getAllRoutes(): string[] {
  const staticRoutes = ["/", "/pricing", "/tools"];
  const toolRoutes = TOOL_PAGES.map((page) => page.path);
  const comparisonRoutes = COMPARISON_PAGES.map((page) => `/vs/${page.slug}`);
  const industryRoutes = INDUSTRY_PAGES.map((page) => `/for/${page.slug}`);
  return [...staticRoutes, ...toolRoutes, ...comparisonRoutes, ...industryRoutes];
}

export function renderSitemapXml(origin: string): string {
  const urls = getAllRoutes()
    .map((path) => `  <url><loc>${origin}${path}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function renderRobotsTxt(origin: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
}
