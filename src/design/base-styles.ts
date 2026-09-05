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
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--accent); }
  h1 {
    font-size: clamp(2.25rem, 5vw, 3.5rem); font-weight: 800; letter-spacing: -0.02em;
    line-height: 1.08; margin: 0 0 0.9rem;
  }
  h1:first-of-type { margin-top: 0; }
  h2 { font-size: 1.6rem; font-weight: 750; letter-spacing: -0.01em; margin: 1.75rem 0 0.9rem; }
  h3 { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.4rem; }
  p { margin: 0 0 0.9rem; }
  .muted { color: var(--muted); }
  code, pre, .key {
    background: var(--bg-alt); padding: 0.15rem 0.4rem; border-radius: 6px;
    font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 0.88em;
    word-break: break-all;
  }
  pre { display: block; padding: 0.9rem 1rem; overflow-x: auto; }

  .eyebrow {
    display: inline-flex; align-items: center; gap: 0.4rem;
    text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.75rem;
    font-weight: 700; color: var(--accent); margin: 0 0 1.1rem;
    padding: 0.35rem 0.85rem; border-radius: 999px;
    background: var(--bg-alt); border: 1px solid var(--border);
  }

  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
    padding: 0.7rem 1.25rem; border-radius: var(--radius-sm);
    text-decoration: none; font-weight: 600; font-size: 0.95rem;
    border: 1px solid var(--border); color: var(--text);
    background: var(--card-bg); font-family: inherit; cursor: pointer;
    box-shadow: var(--shadow-sm);
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  }
  .btn:hover { border-color: var(--accent); transform: translateY(-1px); box-shadow: var(--shadow-md); }
  .btn-primary {
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    border-color: transparent; color: var(--accent-contrast); box-shadow: var(--shadow-glow);
  }
  .btn-primary:hover { transform: translateY(-1px); filter: brightness(1.06); box-shadow: var(--shadow-glow), var(--shadow-md); }

  .badge { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; }
  .badge-good { background: var(--status-good-bg); color: var(--status-good-text); }
  .badge-warn { background: var(--status-warn-bg); color: var(--status-warn-text); }
  .badge-neutral { background: var(--status-neutral-bg); color: var(--status-neutral-text); }

  .callout {
    border: 1px solid var(--border); background: var(--bg-alt); border-radius: var(--radius-md);
    padding: 1.1rem 1.25rem; font-size: 0.95rem;
  }

  .card {
    background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-md);
    padding: 1.5rem 1.6rem; box-shadow: var(--shadow-sm);
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  }
  .card h3 { margin-bottom: 0.6rem; }
  .card p { margin-bottom: 0; }
  a.card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); border-color: var(--accent); }

  .card-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 2.5rem; height: 2.5rem; border-radius: var(--radius-sm); margin-bottom: 1rem;
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, transparent), color-mix(in srgb, var(--accent-2) 16%, transparent));
    color: var(--accent);
  }
  .card-icon svg { width: 1.3rem; height: 1.3rem; }

  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--border); font-size: 0.92rem; vertical-align: top; }
  th { font-weight: 700; opacity: 0.8; }
  .table-scroll { overflow-x: auto; }

  input, select {
    font: inherit; padding: 0.4rem 0.55rem; border-radius: var(--radius-sm);
    border: 1px solid var(--border); background: transparent; color: inherit;
  }

  /* CodeWindow — deliberately fixed-dark regardless of page theme, like a
     real editor/terminal screenshot, so it reads consistently in both. */
  .code-window {
    border-radius: var(--radius-md); overflow: hidden; background: #0b0d12;
    box-shadow: var(--shadow-lg); border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .code-window-bar {
    display: flex; align-items: center; gap: 0.4rem; padding: 0.7rem 0.9rem;
    background: #14161d; border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .code-window-dot { width: 0.65rem; height: 0.65rem; border-radius: 999px; display: inline-block; }
  .code-window-title { margin-left: 0.5rem; font-size: 0.78rem; color: #8a8f9c; font-family: ui-monospace, monospace; }
  .code-window-body {
    margin: 0; padding: 1.35rem 1.5rem; background: transparent; color: #e3e5f0;
    font-size: 0.86rem; line-height: 1.65; overflow-x: auto; white-space: pre;
  }
  .tok-key { color: #7dd3fc; }
  .tok-str { color: #86efac; }
  .tok-num { color: #fca5a5; }
  .tok-punc { color: #6b7280; }
  .tok-comment { color: #6b7280; font-style: italic; }
`;
