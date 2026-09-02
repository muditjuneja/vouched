/**
 * Marketing-site HTML rendering. Deliberately separate from
 * `src/dashboard/html.ts` — the dashboard is a utilitarian control panel
 * for signed-in tenants, this is a public, unauthenticated, crawlable
 * marketing/pSEO surface that wants its own visual identity (hero
 * sections, pricing cards, nav). Both share the same plain
 * string-template approach (no JSX toolchain to configure or verify
 * unrun in this sandbox) and re-export `esc()` so escaping stays
 * consistent across the whole app.
 */
export { esc } from "../dashboard/html";
import { esc } from "../dashboard/html";

export interface LayoutOptions {
  /** Full `<title>` text — already specific to the page, e.g. "Pricing — mcp-seo-toolkit". */
  title: string;
  /** Goes verbatim into `<meta name="description">` — keep it real and specific per page. */
  description: string;
  /** Absolute URL for `<link rel="canonical">`. */
  canonicalUrl: string;
  /** Page body markup. Must contain exactly one `<h1>`. */
  bodyHtml: string;
}

const NAV = `
  <nav class="nav">
    <a class="brand" href="/">mcp-seo-toolkit</a>
    <div class="nav-links">
      <a href="/tools">Tools</a>
      <a href="/pricing">Pricing</a>
      <a href="/vs/ahrefs">Compare</a>
      <a href="/dashboard">Sign in</a>
    </div>
  </nav>`;

const FOOTER = `
  <footer class="site-footer">
    <div class="footer-grid">
      <div>
        <p class="brand">mcp-seo-toolkit</p>
        <p class="muted">An open-source (MIT), self-hostable MCP server for
          SEO and marketing data — keyword research, backlinks, SERP,
          AI-visibility, technical audits, and your own Search
          Console/Analytics, callable directly from an MCP client.</p>
      </div>
      <div>
        <p class="footer-heading">Product</p>
        <a href="/pricing">Pricing</a>
        <a href="/tools">All tools</a>
        <a href="/dashboard">Cloud dashboard</a>
      </div>
      <div>
        <p class="footer-heading">Compare</p>
        <a href="/vs/ahrefs">vs Ahrefs</a>
        <a href="/vs/semrush">vs Semrush</a>
        <a href="/vs/open-seo">vs OpenRush</a>
      </div>
      <div>
        <p class="footer-heading">Use cases</p>
        <a href="/for/agencies">For agencies</a>
        <a href="/for/indie-hackers">For indie hackers</a>
      </div>
    </div>
    <p class="muted footnote">MIT licensed. Self-host it for free, or run
      the hosted version. <a href="/sitemap.xml">Sitemap</a></p>
  </footer>`;

const STYLE = `
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --bg-alt: #f6f7f9;
    --text: #16181d;
    --muted: #5b6270;
    --border: #e3e5ea;
    --accent: #2952e3;
    --accent-contrast: #ffffff;
    --card-bg: #ffffff;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #0f1115;
      --bg-alt: #161920;
      --text: #eef0f4;
      --muted: #9aa1b0;
      --border: #262a33;
      --accent: #6f8dff;
      --accent-contrast: #0f1115;
      --card-bg: #161920;
    }
  }
  :root[data-theme="dark"] {
    --bg: #0f1115;
    --bg-alt: #161920;
    --text: #eef0f4;
    --muted: #9aa1b0;
    --border: #262a33;
    --accent: #6f8dff;
    --accent-contrast: #0f1115;
    --card-bg: #161920;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  a { color: var(--accent); }
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
  h1 { font-size: clamp(1.9rem, 4vw, 2.7rem); line-height: 1.15; margin: 0 0 0.75rem; }
  h2 { font-size: 1.4rem; margin: 0 0 0.9rem; }
  h3 { font-size: 1.1rem; margin: 0 0 0.4rem; }
  p { margin: 0 0 0.9rem; max-width: 68ch; }
  .lede { font-size: 1.15rem; color: var(--muted); max-width: 60ch; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.78rem;
             font-weight: 700; color: var(--accent); margin: 0 0 0.6rem; }
  .muted { color: var(--muted); }
  code { background: var(--bg-alt); padding: 0.1rem 0.4rem; border-radius: 4px;
         font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 0.88em; }
  ul, ol { padding-left: 1.3rem; }
  li { margin-bottom: 0.4rem; }
  .cta-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .btn {
    display: inline-block; padding: 0.65rem 1.15rem; border-radius: 8px;
    text-decoration: none; font-weight: 600; font-size: 0.95rem;
    border: 1px solid var(--border); color: var(--text);
  }
  .btn:hover { border-color: var(--accent); }
  .btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast); }
  .btn-primary:hover { opacity: 0.92; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .card {
    background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px;
    padding: 1.25rem 1.35rem;
  }
  .card h3 { margin-bottom: 0.5rem; }
  .card p { margin-bottom: 0; }
  .pricing-grid { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .price-card { border: 1px solid var(--border); border-radius: 14px; padding: 1.5rem; background: var(--card-bg); }
  .price-card.featured { border-color: var(--accent); border-width: 2px; }
  .price-amount { font-size: 2rem; font-weight: 700; margin: 0.4rem 0 0.9rem; }
  .price-amount small { font-size: 0.95rem; font-weight: 500; color: var(--muted); }
  table.compare { width: 100%; border-collapse: collapse; margin: 0 0 1rem; }
  table.compare th, table.compare td {
    text-align: left; padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border);
    font-size: 0.94rem; vertical-align: top;
  }
  table.compare th { font-weight: 700; background: var(--bg-alt); }
  table.compare td:first-child { font-weight: 600; white-space: nowrap; }
  .callout {
    border: 1px solid var(--border); background: var(--bg-alt); border-radius: 10px;
    padding: 1rem 1.15rem; font-size: 0.95rem;
  }
  .tool-index-grid { display: grid; gap: 0.9rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  .tool-index-grid a.card { text-decoration: none; color: inherit; display: block; }
  .tool-index-grid .tool-domain { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--accent); font-weight: 700; margin-bottom: 0.35rem; }
  .site-footer { border-top: 1px solid var(--border); margin-top: 3rem; padding: 2.5rem 1.25rem 3rem; }
  .footer-grid { max-width: 1080px; margin: 0 auto; display: grid; gap: 1.75rem;
    grid-template-columns: 2fr 1fr 1fr 1fr; }
  .footer-grid a { display: block; text-decoration: none; color: var(--text); font-size: 0.92rem; margin-bottom: 0.45rem; }
  .footer-heading { font-weight: 700; font-size: 0.85rem; margin: 0 0 0.6rem; }
  .footnote { max-width: 1080px; margin: 1.75rem auto 0; padding-top: 1.25rem; border-top: 1px solid var(--border); }
  @media (max-width: 640px) {
    .footer-grid { grid-template-columns: 1fr 1fr; }
    .nav { flex-direction: column; align-items: flex-start; gap: 0.6rem; }
  }
`;

export function layout(opts: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${esc(opts.canonicalUrl)}">
<style>${STYLE}</style>
</head>
<body>
${NAV}
<main>
${opts.bodyHtml}
</main>
${FOOTER}
</body>
</html>`;
}
