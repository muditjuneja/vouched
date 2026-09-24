import { Hono } from "hono";
import { looksSignedIn } from "../auth/clerk";
import { isCloudMode, type Env } from "../types/env";
import { findComparisonPage } from "./content/comparisons";
import { findIndustryPage } from "./content/industries";
import { findToolPage } from "./content/tool-pages";
import { renderComparison } from "./pages/ComparisonPage";
import { renderIndustryPage } from "./pages/IndustryPage";
import { renderLanding } from "./pages/LandingPage";
import { renderPrivacy, renderTerms } from "./pages/LegalPages";
import { renderPricing } from "./pages/PricingPage";
import { renderToolPage } from "./pages/ToolPage";
import { renderToolsIndex } from "./pages/ToolsIndexPage";
import { renderRobotsTxt, renderSitemapXml } from "./sitemap";
import { ICON_180_PNG_BASE64, ICON_512_PNG_BASE64, ICON_SVG, OG_PNG_BASE64 } from "./brand-assets.generated";

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

// Pages differ for signed-in visitors (see looksSignedIn), so no shared
// cache may ever store one visitor's copy for another.
marketing.use("*", async (c, next) => {
  await next();
  if (c.res.headers.get("content-type")?.startsWith("text/html")) {
    c.res.headers.set("Cache-Control", "private, no-cache");
    c.res.headers.append("Vary", "Cookie");
  }
});

/** `<link rel=canonical>` and sitemap/robots want an absolute origin+path, not a relative one. */
function canonicalFor(requestUrl: string): string {
  const url = new URL(requestUrl);
  return `${url.origin}${url.pathname}`;
}

function originFor(requestUrl: string): string {
  return new URL(requestUrl).origin;
}

marketing.get("/", (c) => c.html(renderLanding(canonicalFor(c.req.url), isCloudMode(c.env), looksSignedIn(c.req.raw))));

marketing.get("/pricing", (c) => c.html(renderPricing(canonicalFor(c.req.url), isCloudMode(c.env), looksSignedIn(c.req.raw))));

marketing.get("/privacy", (c) => c.html(renderPrivacy(canonicalFor(c.req.url), isCloudMode(c.env), looksSignedIn(c.req.raw))));
marketing.get("/terms", (c) => c.html(renderTerms(canonicalFor(c.req.url), isCloudMode(c.env), looksSignedIn(c.req.raw))));

marketing.get("/tools", (c) => c.html(renderToolsIndex(canonicalFor(c.req.url), isCloudMode(c.env), looksSignedIn(c.req.raw))));
marketing.get("/docs", (c) => c.html(renderToolsIndex(canonicalFor(c.req.url), isCloudMode(c.env), looksSignedIn(c.req.raw))));
marketing.get("/docs/tools", (c) => c.redirect("/tools", 301));
marketing.get("/docs/tools/:slug", (c) => c.redirect(`/tools/${c.req.param("slug")}`, 301));
marketing.get("/docs/:slug", (c) => c.redirect(`/tools/${c.req.param("slug")}`, 301));

marketing.get("/tools/:slug", (c) => {
  const page = findToolPage(c.req.param("slug"));
  if (!page) return c.text("not found", 404);
  return c.html(renderToolPage(page, canonicalFor(c.req.url), isCloudMode(c.env), looksSignedIn(c.req.raw)));
});

marketing.get("/vs/:slug", (c) => {
  const page = findComparisonPage(c.req.param("slug"));
  if (!page) return c.text("not found", 404);
  return c.html(renderComparison(page, canonicalFor(c.req.url), isCloudMode(c.env), looksSignedIn(c.req.raw)));
});

marketing.get("/for/:slug", (c) => {
  const page = findIndustryPage(c.req.param("slug"));
  if (!page) return c.text("not found", 404);
  return c.html(renderIndustryPage(page, canonicalFor(c.req.url), isCloudMode(c.env), looksSignedIn(c.req.raw)));
});

// Brand images (assets/brand/, embedded by `npm run brand:assets`): the
// social preview image, and the icons directories, Google's consent screen
// and server.json point at.
const BRAND_CACHE = "public, max-age=86400";
function pngFromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
const OG_PNG = pngFromBase64(OG_PNG_BASE64);
const ICON_512_PNG = pngFromBase64(ICON_512_PNG_BASE64);
const ICON_180_PNG = pngFromBase64(ICON_180_PNG_BASE64);
marketing.get("/og.png", (c) => c.body(OG_PNG, 200, { "Content-Type": "image/png", "Cache-Control": BRAND_CACHE }));
marketing.get("/brand/icon.svg", (c) => c.body(ICON_SVG, 200, { "Content-Type": "image/svg+xml", "Cache-Control": BRAND_CACHE }));
marketing.get("/brand/icon-512.png", (c) => c.body(ICON_512_PNG, 200, { "Content-Type": "image/png", "Cache-Control": BRAND_CACHE }));
marketing.get("/brand/icon-180.png", (c) => c.body(ICON_180_PNG, 200, { "Content-Type": "image/png", "Cache-Control": BRAND_CACHE }));

marketing.get("/sitemap.xml", (c) => {
  return c.body(renderSitemapXml(originFor(c.req.url)), 200, { "Content-Type": "application/xml; charset=utf-8" });
});

marketing.get("/robots.txt", (c) => {
  return c.text(renderRobotsTxt(originFor(c.req.url)));
});
