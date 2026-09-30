import { describe, expect, it } from "vitest";
import { COMPARISON_PAGES } from "../../../src/marketing/content/comparisons";
import { INDUSTRY_PAGES } from "../../../src/marketing/content/industries";
import { TOOL_PAGES } from "../../../src/marketing/content/tool-pages";
import { getAllRoutes, renderRobotsTxt, renderSitemapXml } from "../../../src/marketing/sitemap";

describe("sitemap route generation", () => {
  it("includes every static route, tool page, comparison page, and industry page exactly once", () => {
    const routes = getAllRoutes();
    const expectedCount =
      6 /* /, /pricing, /docs, /tools, /privacy, /terms */ + TOOL_PAGES.length + COMPARISON_PAGES.length + INDUSTRY_PAGES.length;
    expect(routes).toHaveLength(expectedCount);
    expect(new Set(routes).size).toBe(routes.length); // no duplicates

    expect(routes).toContain("/");
    expect(routes).toContain("/pricing");
    expect(routes).toContain("/docs");
    expect(routes).toContain("/tools");
    expect(routes).toContain("/privacy");
    expect(routes).toContain("/terms");
    for (const page of TOOL_PAGES) {
      expect(routes).toContain(page.path);
    }
    for (const page of COMPARISON_PAGES) {
      expect(routes).toContain(`/vs/${page.slug}`);
    }
    for (const page of INDUSTRY_PAGES) {
      expect(routes).toContain(`/for/${page.slug}`);
    }
  });

  it("renders one <url> entry per route, using the given origin", () => {
    const xml = renderSitemapXml("https://example.com");
    const routes = getAllRoutes();
    const matches = xml.match(/<url>/g) ?? [];
    expect(matches).toHaveLength(routes.length);
    for (const route of routes) {
      expect(xml).toContain(`<loc>https://example.com${route}</loc>`);
    }
    expect(xml.trim().startsWith("<?xml")).toBe(true);
  });

  it("robots.txt allows everything but the dashboard and points at the sitemap for the given origin", () => {
    const robots = renderRobotsTxt("https://example.com");
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /dashboard");
    expect(robots).toContain("Sitemap: https://example.com/sitemap.xml");
  });
});
