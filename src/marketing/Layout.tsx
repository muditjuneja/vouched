import type { PropsWithChildren } from "hono/jsx";
import { BASE_CSS, TOKENS_CSS, renderToString } from "../design";
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
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 1.25rem; }
  .nav {
    display: flex; align-items: center; justify-content: space-between;
    max-width: 1080px; margin: 0 auto; padding: 1.1rem 1.25rem;
    border-bottom: 1px solid var(--border);
  }
  .nav .brand { font-weight: 700; text-decoration: none; color: var(--text); }
  .nav-links { display: flex; gap: 1.25rem; flex-wrap: wrap; }
  .nav-links a { text-decoration: none; color: var(--text); font-size: 0.95rem; }
  .nav-links a:hover { color: var(--accent); }
  main { max-width: 1080px; margin: 0 auto; padding: 0 1.25rem 3rem; }
  section { margin: 2.75rem 0; }
  section:first-of-type { margin-top: 2.5rem; }
  p { max-width: 68ch; }
  .lede { font-size: 1.15rem; color: var(--muted); max-width: 60ch; }
  .eyebrow {
    text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.78rem;
    font-weight: 700; color: var(--accent); margin: 0 0 0.6rem;
  }
  ul, ol { padding-left: 1.3rem; }
  li { margin-bottom: 0.4rem; }
  .cta-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .pricing-grid { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .price-card { border: 1px solid var(--border); border-radius: 14px; padding: 1.5rem; background: var(--card-bg); }
  .price-card.featured { border-color: var(--accent); border-width: 2px; }
  .price-amount { font-size: 2rem; font-weight: 700; margin: 0.4rem 0 0.9rem; }
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
  .site-footer { border-top: 1px solid var(--border); margin-top: 3rem; padding: 2.5rem 1.25rem 3rem; }
  .footer-grid { max-width: 1080px; margin: 0 auto; display: grid; gap: 1.75rem; grid-template-columns: 2fr 1fr 1fr 1fr; }
  .footer-grid a { display: block; text-decoration: none; color: var(--text); font-size: 0.92rem; margin-bottom: 0.45rem; }
  .footer-heading { font-weight: 700; font-size: 0.85rem; margin: 0 0 0.6rem; }
  .footnote { max-width: 1080px; margin: 1.75rem auto 0; padding-top: 1.25rem; border-top: 1px solid var(--border); }
  @media (max-width: 640px) {
    .footer-grid { grid-template-columns: 1fr 1fr; }
    .nav { flex-direction: column; align-items: flex-start; gap: 0.6rem; }
  }
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
      </body>
    </html>
  );
}

/** Every marketing page renders through this — `children` must contain exactly one `<h1>` (each page's own tests assert this). */
export function renderPage(props: PropsWithChildren<LayoutProps>): string {
  return "<!doctype html>" + renderToString(<Layout {...props} />);
}
