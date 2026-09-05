import type { PropsWithChildren } from "hono/jsx";
import { BASE_CSS, FAVICON_HREF, TOKENS_CSS, renderToString } from "../design";
import { Footer } from "./components/Footer";
import { Nav } from "./components/Nav";

/**
 * Layout-only CSS specific to the marketing site's wide, public, crawlable
 * shape (hero sections, nav/footer, pricing/comparison/tool-index grids) —
 * everything else (colors, type scale, buttons, badges, tables, callouts,
 * forms) comes from src/design's shared tokens/base styles. See
 * src/dashboard/Layout.tsx for the other surface's (narrow, authenticated)
 * equivalent.
 */
const MARKETING_CSS = `
  .nav {
    display: flex; align-items: center; justify-content: space-between;
    max-width: 1080px; margin: 0 auto; padding: 1.1rem 1.25rem;
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 10;
    background: color-mix(in srgb, var(--bg) 80%, transparent);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  }
  .nav .brand { font-weight: 800; letter-spacing: -0.01em; text-decoration: none; color: var(--text); }
  .nav-links { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
  .nav-links a { text-decoration: none; color: var(--text); font-size: 0.92rem; font-weight: 500; }
  .nav-links a:hover { color: var(--accent); }
  .nav-links a.btn { font-size: 0.88rem; padding: 0.5rem 1rem; }
  main { max-width: 1080px; margin: 0 auto; padding: 0 1.25rem 3rem; }
  section { margin: 4rem 0; }
  section:first-of-type { margin-top: 0; }
  p { max-width: 68ch; }
  .lede { font-size: 1.2rem; color: var(--muted); max-width: 58ch; }

  .hero {
    position: relative; padding: 4.5rem 0 3.5rem; overflow: hidden;
    margin: 0 -1.25rem; padding-left: 1.25rem; padding-right: 1.25rem;
  }
  .hero::before, .hero::after {
    content: ""; position: absolute; z-index: -1; border-radius: 50%; filter: blur(90px); opacity: 0.35;
  }
  .hero::before { width: 26rem; height: 26rem; background: var(--accent); top: -10rem; left: -6rem; }
  .hero::after { width: 22rem; height: 22rem; background: var(--accent-2); top: -4rem; right: -4rem; }
  .hero-grid { display: grid; gap: 3rem; grid-template-columns: 1.1fr 1fr; align-items: center; }
  .hero-stats { display: flex; gap: 2rem; flex-wrap: wrap; margin-top: 2.25rem; }
  .hero-stat strong { display: block; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.01em; }
  .hero-stat span { font-size: 0.85rem; color: var(--muted); }
  .gradient-text {
    /* Solid, legible fallback color first. Only browsers that actually
       support clipping the background to the text (near-universal today,
       but not guaranteed) get color: transparent — without this @supports
       guard, a browser lacking background-clip: text would render fully
       transparent text on a transparent background: an invisible headline. */
    color: var(--accent);
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    -webkit-background-clip: text; background-clip: text;
  }
  @supports (background-clip: text) or (-webkit-background-clip: text) {
    .gradient-text { color: transparent; }
  }
  @media (max-width: 860px) {
    .hero-grid { grid-template-columns: 1fr; }
  }

  ul, ol { padding-left: 1.3rem; }
  li { margin-bottom: 0.4rem; }
  .cta-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .pricing-grid { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .price-card {
    border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.75rem;
    background: var(--card-bg); box-shadow: var(--shadow-sm);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .price-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
  .price-card.featured { border-color: var(--accent); border-width: 2px; box-shadow: var(--shadow-glow); }
  .price-amount { font-size: 2.25rem; font-weight: 800; letter-spacing: -0.02em; margin: 0.5rem 0 0.9rem; }
  .price-amount small { font-size: 0.95rem; font-weight: 500; color: var(--muted); }
  table.compare th, table.compare td { vertical-align: top; }
  table.compare th { background: var(--bg-alt); }
  table.compare td:first-child { font-weight: 600; white-space: nowrap; }
  .tool-index-grid { display: grid; gap: 0.9rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  .tool-index-grid a.card { text-decoration: none; color: inherit; display: block; }
  .tool-index-grid .tool-domain {
    font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--accent); font-weight: 700; margin-bottom: 0.35rem;
  }
  .site-footer { border-top: 1px solid var(--border); margin-top: 3rem; padding: 3rem 1.25rem 3rem; background: var(--bg-alt); }
  .footer-grid { max-width: 1080px; margin: 0 auto; display: grid; gap: 1.75rem; grid-template-columns: 2fr 1fr 1fr 1fr; }
  .footer-grid .brand { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; margin: 0 0 0.6rem; }
  .footer-grid a { display: block; text-decoration: none; color: var(--text); font-size: 0.92rem; margin-bottom: 0.45rem; }
  .footer-grid a:hover { color: var(--accent); }
  .footer-heading { font-weight: 700; font-size: 0.85rem; margin: 0 0 0.6rem; }
  .footnote { max-width: 1080px; margin: 1.75rem auto 0; padding-top: 1.25rem; border-top: 1px solid var(--border); }
  @media (max-width: 640px) {
    .footer-grid { grid-template-columns: 1fr 1fr; }
    .nav { flex-direction: column; align-items: flex-start; gap: 0.6rem; }
  }

  /* Full-bleed tinted band for section rhythm — breaks out of main's padding the same way .hero does. */
  .band {
    margin: 4rem -1.25rem; padding: 3.5rem 1.25rem; background: var(--bg-alt);
  }

  .domain-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
  .domain-tile { display: flex; gap: 0.75rem; align-items: flex-start; }
  /* Smaller than the default .card-icon (2.5rem) — .card-icon was sized for a
     handful of icons per row in a wide card grid; at the domain grid's denser
     7-tile packing the full-size square read as oversized next to a 1rem h3.
     Same gradient chip treatment, just scaled down. */
  .domain-tile .card-icon {
    flex-shrink: 0; margin-bottom: 0; width: 2.1rem; height: 2.1rem; border-radius: var(--radius-sm);
  }
  .domain-tile .card-icon svg { width: 1.05rem; height: 1.05rem; }
  .domain-tile h3 { margin-bottom: 0.25rem; font-size: 1rem; }
  .domain-tile p { font-size: 0.92rem; margin-bottom: 0; }

  .compare-yes { color: var(--status-good-bg); font-weight: 700; }
  .compare-yes svg { width: 1em; height: 1em; vertical-align: -0.15em; margin-right: 0.3em; }
  .compare-no { color: var(--muted); }

  /* Scroll-reveal — progressive enhancement only. If JS never runs, .js-anim
     is never added to <html>, so this rule never applies and content is
     visible by default. The hero is excluded: above-the-fold content should
     never depend on JS/a scroll event to become visible. */
  @media (prefers-reduced-motion: no-preference) {
    .js-anim section:not(.hero) { opacity: 0; transform: translateY(18px); transition: opacity 0.5s ease, transform 0.5s ease; }
    .js-anim section:not(.hero).in-view { opacity: 1; transform: none; }
  }
  /* Printing (and "save as PDF") never fires scroll/intersection events, so
     without this override every section below whatever the viewport height
     happened to be at print time would print blank — a real, verified
     failure mode, not a hypothetical one. Print output must always show
     everything regardless of animation state. */
  @media print {
    .js-anim section:not(.hero) { opacity: 1 !important; transform: none !important; }
  }
`;

const SCROLL_REVEAL_SCRIPT = `
(function () {
  if (!window.IntersectionObserver) return;
  document.documentElement.classList.add('js-anim');
  var sections = document.querySelectorAll('main section:not(.hero)');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  sections.forEach(function (s) { io.observe(s); });
  // Safety net, not a content gate: a section that never scrolls into view
  // in a live browser tab (a full-page screenshot/archival tool that never
  // dispatches real scroll events, an unusual navigation path) must still
  // end up visible. A normal scrolling reader always triggers the observer
  // well before this fires, so the progressive-reveal effect is unaffected.
  window.setTimeout(function () {
    sections.forEach(function (s) { s.classList.add('in-view'); });
    io.disconnect();
  }, 1500);
})();
`;

export interface LayoutProps {
  /** Full `<title>` text — already specific to the page, e.g. "Pricing — mcp-seo-toolkit". */
  title: string;
  /** Goes verbatim into `<meta name="description">` — keep it real and specific per page. */
  description: string;
  /** Absolute URL for `<link rel="canonical">`. */
  canonicalUrl: string;
}

function Layout({ title, description, canonicalUrl, children }: PropsWithChildren<LayoutProps>) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="icon" href={FAVICON_HREF} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        {/* No OG/Twitter image — none exists in this repo, and a broken image reference is worse than none. Add one (and og:image/twitter:card="summary_large_image") once real artwork exists. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="mcp-seo-toolkit" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <style dangerouslySetInnerHTML={{ __html: TOKENS_CSS + BASE_CSS + MARKETING_CSS }} />
      </head>
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
        <script dangerouslySetInnerHTML={{ __html: SCROLL_REVEAL_SCRIPT }} />
      </body>
    </html>
  );
}

/** Every marketing page renders through this — `children` must contain exactly one `<h1>` (each page's own tests assert this). */
export function renderPage(props: PropsWithChildren<LayoutProps>): string {
  return "<!doctype html>" + renderToString(<Layout {...props} />);
}
