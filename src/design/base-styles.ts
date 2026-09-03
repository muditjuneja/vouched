/**
 * Shared typography/component CSS — the rules that should render
 * identically wherever they're used, regardless of which surface (wide
 * marketing site vs. narrow authenticated dashboard) hosts them. Layout
 * concerns (page width, nav/header shape, page-specific grids) are NOT
 * here — those stay genuinely different per surface and live in each
 * surface's own stylesheet. See src/design/components/ for the JSX
 * components that use these class names.
 */
export const BASE_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  a { color: var(--accent); }
  h1 { font-size: clamp(1.9rem, 4vw, 2.7rem); line-height: 1.15; margin: 0 0 0.75rem; }
  h1:first-of-type { margin-top: 0; }
  h2 { font-size: 1.4rem; margin: 1.75rem 0 0.9rem; }
  h3 { font-size: 1.1rem; margin: 0 0 0.4rem; }
  p { margin: 0 0 0.9rem; }
  .muted { color: var(--muted); }
  code, pre, .key {
    background: var(--bg-alt); padding: 0.15rem 0.4rem; border-radius: 4px;
    font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 0.88em;
    word-break: break-all;
  }
  pre { display: block; padding: 0.9rem 1rem; overflow-x: auto; }

  .btn {
    display: inline-block; padding: 0.65rem 1.15rem; border-radius: 8px;
    text-decoration: none; font-weight: 600; font-size: 0.95rem;
    border: 1px solid var(--border); color: var(--text);
    background: transparent; font-family: inherit; cursor: pointer;
  }
  .btn:hover { border-color: var(--accent); }
  .btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast); }
  .btn-primary:hover { opacity: 0.92; }

  .badge { display: inline-block; padding: 0.1rem 0.55rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; }
  .badge-good { background: var(--status-good-bg); color: var(--status-good-text); }
  .badge-warn { background: var(--status-warn-bg); color: var(--status-warn-text); }
  .badge-neutral { background: var(--status-neutral-bg); color: var(--status-neutral-text); }

  .callout {
    border: 1px solid var(--border); background: var(--bg-alt); border-radius: 10px;
    padding: 1rem 1.15rem; font-size: 0.95rem;
  }

  .card {
    background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px;
    padding: 1.25rem 1.35rem;
  }
  .card h3 { margin-bottom: 0.5rem; }
  .card p { margin-bottom: 0; }

  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--border); font-size: 0.92rem; vertical-align: top; }
  th { font-weight: 700; opacity: 0.8; }
  .table-scroll { overflow-x: auto; }

  input, select {
    font: inherit; padding: 0.4rem 0.55rem; border-radius: 6px;
    border: 1px solid var(--border); background: transparent; color: inherit;
  }
`;
