import type { PropsWithChildren } from "hono/jsx";
import { BASE_CSS, FAVICON_HREF, TOKENS_CSS, renderToString } from "../design";
import { DISPLAY_NAME } from "../lib/product";

/**
 * Dashboard is the same brand as marketing, denser: a control panel on
 * paper, not the public editorial spread and not leftover Inter/blue SaaS.
 */
const DASHBOARD_CSS = `
  body.dash {
    --bg: #f3eadc;
    --matte: #e6d7c0;
    --bg-alt: #ebe1cf;
    --paper: #efe6d6;
    --text: #161310;
    --muted: #5c564e;
    --border: #d4c8ae;
    --accent: #1a1916;
    --accent-2: #1a1916;
    --accent-contrast: #f3eadc;
    --card-bg: #efe6d6;
    --gold: #c9953a;
    --moss: #3f5340;
    --ink: #1a1916;
    --status-good-bg: #3f5340;
    --status-warn-bg: #9a6700;
    --status-neutral-bg: #6e5c46;
    --font: "Instrument Sans", "Segoe UI", sans-serif;
    --font-display: "Fraunces", Georgia, serif;
    --font-mono: "IBM Plex Mono", ui-monospace, monospace;
    --radius-sm: 4px;
    --radius-md: 8px;
    --shadow-sm: none;
    --shadow-md: none;
    --shadow-lg: none;
    --shadow-glow: none;
    color-scheme: light;
    font-family: var(--font);
    background: var(--matte);
    max-width: none;
    margin: 0;
    padding: 14px;
    overflow-x: hidden;
  }
  body.dash::before {
    content: "";
    pointer-events: none;
    position: fixed;
    inset: 0;
    z-index: 0;
    opacity: 0.09;
    mix-blend-mode: multiply;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
  }
  @media (prefers-color-scheme: dark) {
    body.dash:not([data-theme="light"]) {
      --bg: #1b1713;
      --matte: #14110e;
      --bg-alt: #241f19;
      --paper: #221d18;
      --text: #f2e8d6;
      --muted: #b3a794;
      --border: #3c342a;
      --accent: #f2e8d6;
      --accent-2: #f2e8d6;
      --accent-contrast: #1b1713;
      --card-bg: #221d18;
      --ink: #f2e8d6;
      --status-good-bg: #8aa07a;
      color-scheme: dark;
    }
    body.dash:not([data-theme="light"])::before { mix-blend-mode: overlay; opacity: 0.1; }
  }
  .sheet {
    position: relative; z-index: 1;
    max-width: min(880px, 100%); margin: 0 auto; background: var(--bg);
    border: 1px solid var(--border); min-height: calc(100vh - 28px);
    padding: 0 0 3rem;
  }
  .sheet-tick {
    position: absolute; width: 11px; height: 11px; pointer-events: none; z-index: 3;
    border: 1px solid var(--ink); background: var(--bg);
  }
  .sheet-tick.tl { top: -1px; left: -1px; border-right: none; border-bottom: none; }
  .sheet-tick.tr { top: -1px; right: -1px; border-left: none; border-bottom: none; }
  .sheet-tick.bl { bottom: -1px; left: -1px; border-right: none; border-top: none; }
  .sheet-tick.br { bottom: -1px; right: -1px; border-left: none; border-top: none; }
  header.dash-head {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 1rem; padding: 1.15rem 1.5rem; margin: 0;
    border-bottom: 1px solid var(--border);
  }
  header.dash-head a.brand {
    font-family: var(--font-display); font-style: italic; font-weight: 500;
    font-size: 1.35rem; letter-spacing: -0.03em; text-decoration: none; color: var(--text);
  }
  header.dash-head .meta {
    display: flex; gap: 1.1rem; align-items: baseline;
    font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase;
  }
  header.dash-head .meta a { text-decoration: none; color: var(--muted); font-weight: 500; }
  header.dash-head .meta a:hover { color: var(--text); }
  main { padding: 1.75rem 1.5rem 0; }
  .kicker {
    font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--muted); margin: 0 0 0.35rem;
  }
  body.dash h1 {
    font-size: clamp(1.7rem, 3vw, 2.2rem); font-weight: 650; letter-spacing: -0.03em;
    margin: 0 0 1.35rem; line-height: 1.1;
  }
  body.dash h2 {
    font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.14em;
    text-transform: uppercase; font-weight: 500; color: var(--muted);
    margin: 0 0 0.75rem;
  }
  body.dash a { color: inherit; }
  body.dash .btn {
    border-radius: 4px; box-shadow: none; background: transparent;
    border-color: var(--border); color: var(--text);
  }
  body.dash .btn:hover { transform: none; box-shadow: none; background: var(--paper); }
  body.dash .btn-primary {
    background: var(--ink); background-image: none; border-color: var(--ink);
    color: var(--accent-contrast); box-shadow: none;
  }
  body.dash .btn-primary:hover { filter: none; transform: none; box-shadow: none; background: color-mix(in srgb, var(--ink) 88%, var(--gold)); }
  section.panel {
    border: 1px solid var(--border); padding: 1.25rem 1.3rem 1.35rem; margin-bottom: 1.1rem;
  }
  form.inline { display: inline-block; margin: 0; }
  .row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  input, select {
    border-radius: 4px; background: color-mix(in srgb, var(--bg) 50%, white);
    min-width: 10rem;
  }
  .callout { border-radius: 0; background: var(--paper); }
  .key {
    font-family: var(--font-mono); background: var(--paper); border: 1px solid var(--border);
    display: block; padding: 0.75rem 0.9rem; border-radius: 4px; word-break: break-all;
  }
  .meter {
    height: 6px; background: var(--paper); border: 1px solid var(--border); margin: 0.65rem 0 1rem;
  }
  .meter > span { display: block; height: 100%; background: var(--moss); }
  table { font-size: 0.9rem; }
  th { font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; }
  body.dash .badge { border-radius: 4px; font-weight: 500; letter-spacing: 0.02em; }
  ::selection { background: color-mix(in srgb, var(--gold) 45%, white); color: var(--ink); }
  :focus-visible { outline: 1px solid var(--ink); outline-offset: 3px; }
  @media (max-width: 640px) {
    header.dash-head { flex-direction: column; gap: 0.4rem; }
    .row { flex-direction: column; align-items: stretch; }
    input { min-width: 0; width: 100%; }
    body.dash .table-scroll { overflow: visible; }
    body.dash thead { display: none; }
    body.dash table, body.dash tbody, body.dash tr, body.dash td { display: block; width: 100%; }
    body.dash tr { border-bottom: 1px solid var(--border); padding: 0.65rem 0; }
    body.dash td {
      border: none; padding: 0.22rem 0;
      display: grid; grid-template-columns: 7.2rem minmax(0, 1fr); gap: 0.45rem; align-items: start;
    }
    body.dash td::before {
      content: attr(data-label);
      font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--muted); padding-top: 0.18rem;
    }
  }
`;

export interface LayoutProps {
  title: string;
}

function Layout({ title, children }: PropsWithChildren<LayoutProps>) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>
          {title} · {DISPLAY_NAME}
        </title>
        <link rel="icon" href={FAVICON_HREF} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,500&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: TOKENS_CSS + BASE_CSS + DASHBOARD_CSS }} />
      </head>
      <body class="dash">
        <div class="sheet">
          <span class="sheet-tick tl" />
          <span class="sheet-tick tr" />
          <span class="sheet-tick bl" />
          <span class="sheet-tick br" />
          <header class="dash-head">
            <a class="brand" href="/">
              <em>{DISPLAY_NAME}</em>
            </a>
            <div class="meta">
              <a href="/">Site</a>
              <a href="/dashboard">Cloud</a>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}

/** Every dashboard page renders through this: one page-level `<h1>` inside `children`, matching the same rule marketing's Layout enforces. */
export function renderPage(props: PropsWithChildren<LayoutProps>): string {
  return "<!doctype html>" + renderToString(<Layout {...props} />);
}
