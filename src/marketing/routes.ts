import { Hono } from "hono";
import { isCloudMode, type Env } from "../types/env";
import { findComparisonPage } from "./content/comparisons";
import { findIndustryPage } from "./content/industries";
import { findToolPage } from "./content/tool-pages";
import { renderComparison } from "./pages/ComparisonPage";
import { renderIndustryPage } from "./pages/IndustryPage";
import { renderLanding } from "./pages/LandingPage";
import { renderPricing } from "./pages/PricingPage";
import { renderToolPage } from "./pages/ToolPage";
import { renderToolsIndex } from "./pages/ToolsIndexPage";
import { renderRobotsTxt, renderSitemapXml } from "./sitemap";

/**
 * The public, unauthenticated marketing/pSEO site: a self-contained Hono
 * sub-app, exported (not wired into `src/index.ts` here) so it can be
 * mounted with `app.route("/", marketing)`. Mirrors `src/dashboard/routes.ts`'s
 * shape: a plain `Hono<{ Bindings: Env }>`, page-rendering functions kept
 * in `pages.ts`, escaping/layout in `html.ts`. Unlike the dashboard, none
 * of this needs D1/R2/auth: every response is built from static data
 * (`src/mcp/manifest.ts` plus hand-written copy) already in the repo, so
 * every route here is plain, cheap, and fully testable with `app.request()`
 * and a bare `{}` env.
 *
 * Every render call below passes `isCloudMode(c.env)` through to the page,
 * which threads it down into `Nav`/`Footer` (and the landing/pricing/tool
 * pages' own CTAs) so nothing on a deployment without cloud mode enabled
 * ever links to `/dashboard` (see src/dashboard/routes.ts's gate, which
 * 404s that whole path when cloud mode is off).
 */
export const marketing = new Hono<{ Bindings: Env }>();

/** `<link rel=canonical>` and sitemap/robots want an absolute origin+path, not a relative one. */
function canonicalFor(requestUrl: string): string {
  const url = new URL(requestUrl);
  return `${url.origin}${url.pathname}`;
}

function originFor(requestUrl: string): string {
  return new URL(requestUrl).origin;
}

marketing.get("/", (c) => c.html(renderLanding(canonicalFor(c.req.url), isCloudMode(c.env))));

marketing.get("/pricing", (c) => c.html(renderPricing(canonicalFor(c.req.url), isCloudMode(c.env))));

marketing.get("/tools", (c) => c.html(renderToolsIndex(canonicalFor(c.req.url), isCloudMode(c.env))));
marketing.get("/docs", (c) => c.html(renderToolsIndex(canonicalFor(c.req.url), isCloudMode(c.env))));
marketing.get("/docs/tools", (c) => c.redirect("/tools", 301));
marketing.get("/docs/tools/:slug", (c) => c.redirect(`/tools/${c.req.param("slug")}`, 301));
marketing.get("/docs/:slug", (c) => c.redirect(`/tools/${c.req.param("slug")}`, 301));

marketing.get("/tools/:slug", (c) => {
  const page = findToolPage(c.req.param("slug"));
  if (!page) return c.text("not found", 404);
  return c.html(renderToolPage(page, canonicalFor(c.req.url), isCloudMode(c.env)));
});

marketing.get("/vs/:slug", (c) => {
  const page = findComparisonPage(c.req.param("slug"));
  if (!page) return c.text("not found", 404);
  return c.html(renderComparison(page, canonicalFor(c.req.url), isCloudMode(c.env)));
});

marketing.get("/for/:slug", (c) => {
  const page = findIndustryPage(c.req.param("slug"));
  if (!page) return c.text("not found", 404);
  return c.html(renderIndustryPage(page, canonicalFor(c.req.url), isCloudMode(c.env)));
});

marketing.get("/sitemap.xml", (c) => {
  return c.body(renderSitemapXml(originFor(c.req.url)), 200, { "Content-Type": "application/xml; charset=utf-8" });
});

marketing.get("/robots.txt", (c) => {
  return c.text(renderRobotsTxt(originFor(c.req.url)));
});
