/**
 * Dashboard stylesheet: a dense, paper-toned control panel with compact
 * SaaS ergonomics, fixed sidebar app-shell, and crisp alignment.
 */
export const DASHBOARD_CSS = `
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
    padding: 12px;
    height: 100vh;
    height: 100dvh;
    box-sizing: border-box;
    overflow: hidden;
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

  /* Fixed sheet frame with registration ticks */
  .sheet {
    position: relative; z-index: 1;
    background: var(--bg);
    border: 1px solid var(--border);
    height: calc(100vh - 24px);
    height: calc(100dvh - 24px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .sheet-tick {
    position: absolute; width: 11px; height: 11px; pointer-events: none; z-index: 3;
    border: 1px solid var(--ink); background: var(--bg);
  }
  .sheet-tick.tl { top: -1px; left: -1px; border-right: none; border-bottom: none; }
  .sheet-tick.tr { top: -1px; right: -1px; border-left: none; border-bottom: none; }
  .sheet-tick.bl { bottom: -1px; left: -1px; border-right: none; border-top: none; }
  .sheet-tick.br { bottom: -1px; right: -1px; border-left: none; border-top: none; }

  /* Mobile-only hamburger */
  .dash-mobile-toggle { display: none; }
  .dash-mobile-toggle summary {
    cursor: pointer; list-style: none; padding: 0.75rem 1rem;
    font-family: var(--font-mono); font-size: 0.74rem; letter-spacing: 0.08em; text-transform: uppercase;
    border-bottom: 1px solid var(--border);
  }
  .dash-mobile-toggle summary::-webkit-details-marker { display: none; }
  .dash-mobile-toggle summary::before { content: "☰ Menu"; }
  .dash-mobile-toggle[open] summary::before { content: "✕ Close"; }

  /* Shell layout: fixed sidebar on left, independent scrolling main area */
  .dash-shell {
    display: flex;
    align-items: stretch;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .dash-sidebar {
    display: flex; flex-direction: column; gap: 1.25rem;
    width: 14rem; flex-shrink: 0; padding: 1.25rem 1rem;
    border-right: 1px solid var(--border);
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
  }
  .dash-sidebar > a.brand {
    font-family: var(--font-display); font-style: italic; font-weight: 500;
    font-size: 1.25rem; letter-spacing: -0.03em; text-decoration: none; color: var(--text);
  }
  .dash-nav-items { display: flex; flex-direction: column; gap: 0.12rem; flex: 1; }
  .dash-sidebar .nav-item {
    padding: 0.42rem 0.65rem;
    font-size: 0.88rem;
    border-radius: var(--radius-sm);
  }
  .dash-back-link {
    font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase;
    text-decoration: none; color: var(--muted);
  }
  .dash-back-link:hover { color: var(--text); }
  .dash-main {
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
  }
  main.dash-content { padding: 1.35rem 1.5rem 2.5rem; }

  /* Headings & Page Header */
  .kicker {
    font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--muted); margin: 0 0 0.25rem;
  }
  body.dash h1 {
    font-size: 1.45rem; font-weight: 650; letter-spacing: -0.025em;
    margin: 0 0 1rem; line-height: 1.2;
  }
  body.dash h2 {
    font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.12em;
    text-transform: uppercase; font-weight: 500; color: var(--muted);
    margin: 0 0 0.6rem;
  }
  body.dash a { color: inherit; }
  .page-header-row {
    display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .page-header-row h1, .page-header-row h2 { margin-bottom: 0; }

  /* Compact button styling */
  body.dash .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
    border-radius: 4px; box-shadow: none; background: transparent;
    border-color: var(--border); color: var(--text);
    padding: 0.42rem 0.85rem; font-size: 0.82rem; font-weight: 500;
    line-height: 1.25; font-family: inherit; cursor: pointer; text-decoration: none;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  body.dash .btn:hover { transform: none; box-shadow: none; background: var(--paper); }
  body.dash .btn-primary {
    background: var(--ink); background-image: none; border-color: var(--ink);
    color: var(--accent-contrast); box-shadow: none; font-weight: 600;
  }
  body.dash .btn-primary:hover {
    filter: none; transform: none; box-shadow: none;
    background: color-mix(in srgb, var(--ink) 88%, var(--gold));
  }
  body.dash .btn-sm {
    padding: 0.24rem 0.55rem;
    font-size: 0.74rem;
    line-height: 1.2;
    font-family: var(--font-mono);
  }

  /* Panels & Layout Utilities */
  section.panel {
    border: 1px solid var(--border); padding: 1rem 1.15rem 1.15rem; margin-bottom: 0.9rem;
    background: var(--bg);
  }
  form.inline { display: inline-block; margin: 0; }
  .row { display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; }
  input, select {
    border-radius: 4px; background: var(--paper);
    min-width: 10rem; font: inherit; padding: 0.35rem 0.55rem;
    font-size: 0.84rem; border: 1px solid var(--border); color: inherit;
  }

  /* Badges */
  body.dash .badge {
    display: inline-block; padding: 0.12rem 0.5rem;
    border-radius: 4px; font-weight: 500; font-size: 0.72rem; letter-spacing: 0.02em;
  }

  /* Tables: compact, vertically centered */
  body.dash table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  body.dash th {
    font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--muted); padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--border); text-align: left; font-weight: 500;
  }
  body.dash td {
    padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: middle; font-size: 0.84rem;
  }
  body.dash tbody tr:last-child td { border-bottom: none; }
  body.dash th.text-right, body.dash td.text-right { text-align: right; }
  .websites-table th:last-child, .table-activity th:last-child, .table-usage th:last-child { text-align: right; }
  .col-actions { text-align: right; }
  .row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 0.4rem; flex-wrap: nowrap; }

  /* Compact Domain & Inline Copy */
  .site-domain-row { display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 0.2rem; }
  .site-domain { font-family: var(--font-mono); font-size: 0.78rem; color: var(--muted); line-height: 1; }
  .btn-copy-inline {
    font-family: var(--font-mono); font-size: 0.66rem; padding: 0.12rem 0.4rem; line-height: 1.2;
    border: 1px solid var(--border); background: var(--paper); color: var(--muted); border-radius: 3px;
    cursor: pointer; transition: all 0.15s ease;
  }
  .btn-copy-inline:hover { color: var(--text); border-color: var(--text); background: var(--bg-alt); }
  .btn-copy-inline.copied { border-color: var(--status-good-bg); color: var(--status-good-bg); }
  .btn-connect-link {
    font-family: var(--font-mono); font-size: 0.7rem; color: var(--gold); text-decoration: none;
    letter-spacing: 0.02em; font-weight: 500;
  }
  .btn-connect-link:hover { text-decoration: underline; }

  /* Stat cards */
  .stat-grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr)); margin-bottom: 0.9rem; }
  body.dash .stat-card {
    border-radius: 0; box-shadow: none; padding: 0.85rem 1rem;
    border: 1px solid var(--border); background: var(--card-bg);
  }
  body.dash .stat-card-label { margin: 0 0 0.25rem; font-size: 0.75rem; color: var(--muted); }
  body.dash .stat-card-value { margin: 0; font-size: 1.35rem; font-weight: 700; letter-spacing: -0.01em; }
  body.dash .stat-card-sublabel { margin: 0.25rem 0 0; font-size: 0.75rem; }

  /* Slide-over drawers (Add website & Edit website) */
  .drawer-toggle-input {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  label.drawer-open-btn { cursor: pointer; user-select: none; }
  label.drawer-cancel-btn { cursor: pointer; user-select: none; }
  .drawer-backdrop {
    position: fixed; inset: 0; z-index: 19; cursor: pointer;
    background: rgba(20, 17, 14, 0.45); opacity: 0; pointer-events: none;
    transition: opacity 0.2s ease;
  }
  aside.add-website-drawer,
  aside.edit-website-drawer,
  aside.slide-drawer {
    position: fixed; top: 0; right: 0; z-index: 20;
    width: min(26rem, 92vw); height: 100%; overflow-y: auto;
    display: flex; flex-direction: column; gap: 0.85rem;
    background: var(--bg); padding: 1.25rem;
    border-left: 1px solid var(--border); border-radius: 0; margin: 0;
    box-shadow: var(--shadow-lg);
    transform: translateX(100%); transition: transform 0.2s ease;
    box-sizing: border-box;
  }
  .drawer-toggle-input:checked ~ .drawer-backdrop { opacity: 1; pointer-events: auto; }
  .drawer-toggle-input:checked ~ aside.add-website-drawer,
  .drawer-toggle-input:checked ~ aside.edit-website-drawer,
  .drawer-toggle-input:checked ~ aside.slide-drawer { transform: translateX(0); }
  .drawer-form {
    display: flex; flex-direction: column; gap: 0.95rem; margin: 0;
  }
  .drawer-form .form-group {
    display: flex; flex-direction: column; gap: 0.35rem;
  }
  .drawer-form .form-label {
    font-size: 0.8rem; font-weight: 600; color: var(--text);
  }
  .drawer-form .form-input,
  .drawer-form input,
  .drawer-form select {
    width: 100%; box-sizing: border-box; font-size: 0.82rem; padding: 0.45rem 0.65rem;
    border: 1px solid var(--border); border-radius: 4px; background: var(--paper); color: var(--text);
    font-family: inherit;
  }
  .drawer-form select {
    cursor: pointer;
  }
  .drawer-form .font-normal { font-weight: 400; }
  .drawer-actions {
    display: flex; align-items: center; gap: 0.6rem; margin-top: 0.5rem; padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }
  .drawer-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;
    padding-bottom: 0.75rem; border-bottom: 1px solid var(--border);
  }
  .drawer-header h2 {
    font-family: var(--font-display); font-size: 1.2rem; font-weight: 600;
    letter-spacing: -0.02em; text-transform: none; color: var(--text); margin: 0;
  }
  .drawer-subtitle { margin: 0.2rem 0 0; font-size: 0.78rem; line-height: 1.35; color: var(--muted); }
  label.drawer-close {
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    width: 1.7rem; height: 1.7rem; border-radius: 4px; border: 1px solid var(--border);
    background: var(--paper); color: var(--muted); font-size: 0.8rem; line-height: 1; flex-shrink: 0;
    transition: all 0.15s ease;
  }
  label.drawer-close:hover { color: var(--text); border-color: var(--text); background: var(--bg-alt); }
  .widget-connections {
    display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.35rem;
    padding: 0.75rem 0.85rem; background: var(--paper); border: 1px solid var(--border); border-radius: 4px;
  }
  .widget-connect-row {
    display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; font-size: 0.82rem;
  }
  .widget-connect-label { font-weight: 500; color: var(--text); }
  .widget-connect-action { display: flex; align-items: center; gap: 0.4rem; }
  .drawer-empty-text { font-size: 0.8rem; line-height: 1.4; margin: 0.25rem 0; }
  .discovered-list { display: flex; flex-direction: column; gap: 0.5rem; }
  form.discovered-row {
    display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; margin: 0;
    border: 1px solid var(--border); background: var(--paper); border-radius: 4px; padding: 0.65rem 0.8rem;
  }
  .discovered-row > div:first-child { flex: 1; min-width: 0; }
  .discovered-row-name { font-weight: 600; font-size: 0.85rem; overflow-wrap: anywhere; }
  .discovered-row-source { font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 0.12rem; }
  .discovered-row button { flex-shrink: 0; }

  /* Callouts & Keys */
  .callout { border-radius: 0; background: var(--paper); padding: 0.85rem 1rem; font-size: 0.88rem; }
  .key {
    font-family: var(--font-mono); background: var(--paper); border: 1px solid var(--border);
    display: block; padding: 0.65rem 0.8rem; border-radius: 4px; word-break: break-all; font-size: 0.82rem;
  }
  .meter {
    height: 5px; background: var(--paper); border: 1px solid var(--border); margin: 0.5rem 0 0.85rem;
  }
  .meter > span { display: block; height: 100%; background: var(--moss); }

  /* Sidebar User Card */
  .dash-user-card {
    margin-top: auto;
    padding-top: 0.9rem;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .dash-user-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
  .dash-user-avatar {
    width: 1.85rem;
    height: 1.85rem;
    border-radius: 999px;
    background: var(--ink);
    color: var(--accent-contrast);
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.78rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .dash-user-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 0.05rem;
  }
  .dash-user-email {
    font-size: 0.78rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text);
  }
  .dash-plan-badge {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .dash-user-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .dash-user-action {
    text-decoration: none;
    color: var(--muted);
  }
  .dash-user-action:hover {
    color: var(--text);
  }
  .dash-user-action-sep {
    opacity: 0.35;
  }
  .dash-logout-link {
    color: var(--status-warn-bg);
  }
  .dash-logout-link:hover {
    text-decoration: underline;
  }

  /* Breadcrumbs */
  .dash-breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.5rem;
  }
  .dash-breadcrumbs a {
    text-decoration: none;
    color: var(--muted);
  }
  .dash-breadcrumbs a:hover {
    color: var(--text);
  }
  .dash-breadcrumbs .sep {
    opacity: 0.4;
  }

  /* Alerts */
  .dash-alert {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    padding: 0.65rem 0.85rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 0.84rem;
  }
  .dash-alert-success {
    background: color-mix(in srgb, var(--status-good-bg) 14%, var(--paper));
    border: 1px solid var(--status-good-bg);
    color: var(--text);
  }
  .dash-alert-warn {
    background: color-mix(in srgb, var(--status-warn-bg) 14%, var(--paper));
    border: 1px solid var(--status-warn-bg);
    color: var(--text);
  }
  .dash-alert-info {
    background: var(--paper);
    border: 1px solid var(--border);
    color: var(--text);
  }

  /* Copy Buttons & Snippets */
  .btn-copy {
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }
  .btn-copy.copied {
    border-color: var(--status-good-bg);
    color: var(--status-good-bg);
  }
  .code-snippet-box {
    position: relative;
    margin: 0.65rem 0 1rem;
  }
  .code-snippet-box pre {
    margin: 0;
    padding-right: 4.5rem;
    font-size: 0.82rem;
  }
  .code-snippet-copy {
    position: absolute;
    top: 0.4rem;
    right: 0.45rem;
  }

  /* Quick-connect banner */
  .quick-connect-banner {
    border: 1px solid var(--border);
    background: var(--paper);
    padding: 0.95rem 1.1rem;
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  .quick-connect-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    flex-wrap: wrap;
  }
  .quick-connect-header h2 {
    font-family: var(--font-display);
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    text-transform: none;
    color: var(--text);
    margin: 0;
  }
  .quick-connect-endpoint {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }
  .quick-connect-url {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    background: var(--bg);
    border: 1px solid var(--border);
    padding: 0.28rem 0.55rem;
    border-radius: 4px;
    word-break: break-all;
  }

  /* Tier Cards */
  .tier-grid {
    display: grid;
    gap: 0.85rem;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    margin-bottom: 1.25rem;
  }
  .tier-card {
    border: 1px solid var(--border);
    background: var(--paper);
    padding: 1.1rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.75rem;
    border-radius: 4px;
  }
  .tier-card.active-tier {
    border: 2px solid var(--ink);
    position: relative;
  }
  .tier-card-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .tier-title {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 600;
    margin: 0;
  }
  .tier-price {
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 700;
  }
  .tier-features {
    list-style: none;
    padding: 0;
    margin: 0.4rem 0 0.75rem;
    font-size: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.28rem;
  }
  .tier-features li::before {
    content: "✓ ";
    font-weight: bold;
    color: var(--status-good-bg);
  }

  /* Empty state */
  .empty-state-card {
    text-align: center;
    padding: 2rem 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.65rem;
  }
  .empty-state-card p {
    max-width: 24rem;
    margin: 0 auto;
    font-size: 0.86rem;
  }

  ::selection { background: color-mix(in srgb, var(--gold) 45%, white); color: var(--ink); }
  :focus-visible { outline: 1px solid var(--ink); outline-offset: 2px; }

  /* Responsive breakpoints */
  @media (max-width: 780px) {
    .dash-mobile-toggle { display: block; }
    .dash-shell { position: relative; overflow: hidden; }
    .dash-sidebar {
      position: absolute; top: 0; left: 0; height: 100%; width: 14rem; z-index: 5;
      background: var(--bg); transform: translateX(-100%); transition: transform 0.2s ease;
      box-shadow: var(--shadow-lg);
    }
    .dash-mobile-toggle[open] ~ .dash-shell .dash-sidebar { transform: translateX(0); }
    main.dash-content { padding: 1.25rem 1rem 2.5rem; }
  }
  @media (max-width: 640px) {
    .row { flex-direction: column; align-items: stretch; }
    input { min-width: 0; width: 100%; }
    body.dash .table-scroll { overflow: visible; }
    body.dash thead { display: none; }
    body.dash table, body.dash tbody, body.dash tr, body.dash td { display: block; width: 100%; }
    body.dash tr { border-bottom: 1px solid var(--border); padding: 0.55rem 0; }
    body.dash td {
      border: none; padding: 0.2rem 0;
      display: grid; grid-template-columns: 6.8rem minmax(0, 1fr); gap: 0.4rem; align-items: start;
    }
    body.dash td::before {
      content: attr(data-label);
      font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--muted); padding-top: 0.15rem;
    }
    .row-actions { justify-content: flex-start; }
    .col-actions { text-align: left; }
    .websites-table th:last-child { text-align: left; }
  }

  /* Standalone Auth / Gate Shell (no sidebar) */
  .dash-auth-shell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    padding: 2rem 1.5rem;
    box-sizing: border-box;
    overflow-y: auto;
  }
  .auth-card {
    max-width: 28rem;
    width: 100%;
    background: var(--paper);
    border: 1px solid var(--border);
    padding: 2.25rem 2rem;
    box-sizing: border-box;
    text-align: center;
  }
  .auth-brand {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 2.2rem;
    letter-spacing: -0.03em;
    color: var(--text);
    margin-bottom: 0.25rem;
    line-height: 1;
  }
  .auth-badge {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 1.5rem;
  }
  .auth-title {
    font-family: var(--font-display);
    font-size: 1.45rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0 0 0.65rem;
    color: var(--text);
  }
  .auth-desc {
    font-size: 0.88rem;
    color: var(--muted);
    line-height: 1.5;
    margin: 0 0 1.75rem;
  }
  .auth-btn-primary {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    padding: 0.75rem 1.25rem;
    font-size: 0.92rem;
    font-weight: 550;
    margin-bottom: 1.5rem;
  }
  .auth-checklist {
    list-style: none;
    padding: 0.9rem 0 0;
    margin: 0;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    text-align: left;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .auth-checklist li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .auth-check-icon {
    color: var(--status-good-bg);
    font-weight: bold;
    flex-shrink: 0;
  }
  .auth-footer {
    margin-top: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 28rem;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .auth-footer a {
    color: var(--text);
    text-decoration: none;
  }
  .auth-footer a:hover {
    text-decoration: underline;
  }
`;
