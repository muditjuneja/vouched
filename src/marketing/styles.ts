/**
 * Layout-only CSS specific to the marketing site's wide, public, crawlable
 * shape (hero sections, nav/footer, pricing/comparison/tool-index grids,
 * agent simulation, and provenance anatomy).
 *
 * Everything else (colors, type scale, buttons, badges, tables, callouts,
 * forms) comes from src/design's shared tokens/base styles.
 */
export const MARKETING_CSS = `
  body.marketing {
    --bg: #f3eadc;
    --matte: #e6d7c0;
    --bg-alt: #ebe1cf;
    --paper: #efe6d6;
    --paper-deep: #e4d8c2;
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
    --font: "Instrument Sans", "Segoe UI", sans-serif;
    --font-display: "Fraunces", "Iowan Old Style", Georgia, serif;
    --font-mono: "IBM Plex Mono", ui-monospace, monospace;
    --radius-sm: 4px;
    --radius-md: 8px;
    --shadow-sm: none;
    --shadow-md: none;
    --shadow-lg: 0 22px 50px rgba(40, 28, 12, 0.08);
    --shadow-glow: none;
    color-scheme: light;
    font-family: var(--font);
    background: var(--matte);
    overflow-x: hidden;
    max-width: 100%;
  }
  body.marketing::before {
    content: "";
    pointer-events: none;
    position: fixed;
    inset: 0;
    z-index: 0;
    opacity: 0.11;
    mix-blend-mode: multiply;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
  }
  @media (prefers-color-scheme: dark) {
    body.marketing:not([data-theme="light"]) {
      --bg: #1b1713;
      --matte: #14110e;
      --bg-alt: #241f19;
      --paper: #221d18;
      --paper-deep: #2c261f;
      --text: #f2e8d6;
      --muted: #b3a794;
      --border: #3c342a;
      --accent: #f2e8d6;
      --accent-2: #f2e8d6;
      --accent-contrast: #1b1713;
      --card-bg: #221d18;
      --gold: #d4a256;
      --moss: #8aa07a;
      --ink: #f2e8d6;
      color-scheme: dark;
    }
    body.marketing:not([data-theme="light"])::before { mix-blend-mode: overlay; opacity: 0.12; }
  }
  .sheet {
    position: relative;
    z-index: 1;
    max-width: 1240px;
    width: calc(100% - 28px);
    margin: 14px auto;
    background: var(--bg);
    border: 1px solid var(--border);
    min-height: calc(100vh - 28px);
  }
  .sheet-tick {
    position: absolute; width: 11px; height: 11px; pointer-events: none; z-index: 3;
    border: 1px solid var(--ink); background: var(--bg);
  }
  .sheet-tick.tl { top: -1px; left: -1px; border-right: none; border-bottom: none; }
  .sheet-tick.tr { top: -1px; right: -1px; border-left: none; border-bottom: none; }
  .sheet-tick.bl { bottom: -1px; left: -1px; border-right: none; border-top: none; }
  .sheet-tick.br { bottom: -1px; right: -1px; border-left: none; border-top: none; }
  body.marketing a { color: inherit; text-underline-offset: 0.18em; }
  body.marketing .btn-primary { padding: 0.82rem 1.45rem; font-size: 0.92rem; }
  body.marketing .btn {
    border-radius: 4px; box-shadow: none; background: transparent;
    border-color: var(--border); color: var(--text);
  }
  body.marketing .btn:hover { transform: none; box-shadow: none; background: var(--paper-deep); }
  body.marketing .btn-primary {
    background: var(--ink);
    background-image: none;
    box-shadow: none;
    border-color: var(--ink);
    color: var(--accent-contrast);
    border-radius: 4px;
    letter-spacing: 0.01em;
  }
  body.marketing .btn-primary:hover {
    filter: none; transform: none; background: color-mix(in srgb, var(--ink) 88%, var(--gold));
    box-shadow: none;
  }
  body.marketing .card, body.marketing .price-card {
    background: transparent; box-shadow: none; border-radius: 0;
    border: 1px solid var(--border);
  }
  body.marketing .pricing-grid .price-card {
    border: none; border-right: 1px solid var(--border); box-shadow: none;
  }
  body.marketing .pricing-grid .price-card:last-child { border-right: none; }
  body.marketing .pricing-grid .price-card.featured {
    background: var(--paper); border-color: var(--border); box-shadow: none;
  }
  @media (max-width: 860px) {
    body.marketing .pricing-grid .price-card { border-right: none; border-bottom: 1px solid var(--border); }
    body.marketing .pricing-grid .price-card:last-child { border-bottom: none; }
  }
  body.marketing .card:hover, body.marketing a.card:hover, body.marketing .price-card:hover {
    transform: none; box-shadow: none; border-color: var(--text);
  }
  body.marketing .card-icon {
    background: none; border: 1px solid var(--border); border-radius: 0; color: var(--text);
  }
  body.marketing .eyebrow {
    font-family: var(--font-mono);
    background: transparent;
    border: none;
    padding: 0;
    letter-spacing: 0.16em;
    font-weight: 500;
    color: var(--muted);
  }
  body.marketing .eyebrow::before {
    content: "◆";
    margin-right: 0.55rem;
    color: var(--gold);
    font-size: 0.65em;
    letter-spacing: 0;
  }
  body.marketing h1 { font-weight: 650; font-size: clamp(3.2rem, 8vw, 6rem); line-height: 0.92; }
  body.marketing .hero-line {
    display: block;
    font-size: clamp(1.7rem, 3.6vw, 2.7rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 1.05;
    margin-bottom: 0.12em;
  }
  body.marketing .punch {
    font-family: var(--font-display);
    font-style: italic;
    font-weight: 400;
    font-optical-sizing: auto;
    font-size: 1.02em;
    color: var(--text);
    position: relative;
    display: inline-block;
    letter-spacing: -0.045em;
    line-height: 0.88;
  }
  body.marketing .punch-rule {
    display: block; width: 108%; height: 0.42em; margin: 0.02em 0 0 -2%;
    color: var(--gold); overflow: visible;
  }
  @media (prefers-reduced-motion: no-preference) {
    body.marketing .punch-rule path {
      stroke-dasharray: 420; stroke-dashoffset: 420;
      animation: punch-draw 1.35s cubic-bezier(.22,.61,.36,1) 0.18s forwards;
    }
    body.marketing .punch-rule path:last-child { animation-delay: 0.42s; }
  }
  @keyframes punch-draw { to { stroke-dashoffset: 0; } }
  body.marketing .hero-inner h1 { font-size: clamp(2.1rem, 5vw, 3.4rem); line-height: 1.05; }

  .nav {
    display: flex; align-items: baseline; justify-content: space-between;
    max-width: none; margin: 0; padding: 1.5rem 2.15rem 1.25rem;
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 10;
    background: var(--bg);
  }
  .nav .brand {
    font-family: var(--font-display); font-weight: 500; font-size: 1.55rem;
    letter-spacing: -0.03em; text-decoration: none; color: var(--text); line-height: 1;
  }
  .nav .brand em { font-style: italic; font-weight: 500; }
  .nav-links { display: flex; align-items: center; gap: 1.6rem; flex-wrap: wrap; }
  .nav-links a {
    text-decoration: none; color: var(--muted); font-size: 0.84rem; font-weight: 500;
    letter-spacing: 0.04em;
  }
  .nav-links a:hover { color: var(--text); }
  .nav-links a.btn { font-size: 0.84rem; padding: 0.4rem 0.85rem; color: var(--text); }
  main { max-width: none; margin: 0; padding: 0 2.15rem 5.5rem; }
  section { margin: 5.25rem 0; }
  section:first-of-type { margin-top: 0; }
  p { max-width: 62ch; }
  .lede { font-size: 1.14rem; color: var(--muted); max-width: 34rem; line-height: 1.58; }
  .chapter {
    font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--muted); margin: 0 0 0.65rem;
  }
  body.marketing h2 { font-size: clamp(1.7rem, 3vw, 2.15rem); font-weight: 600; letter-spacing: -0.03em; margin: 0 0 1rem; }

  .hero {
    position: relative; padding: 3.5rem 0 2.25rem; overflow: hidden;
    margin: 0 -2.15rem; padding-left: 2.15rem; padding-right: 2.15rem;
    min-height: min(86vh, 52rem);
    display: flex; flex-direction: column;
  }
  .hero-inner { min-height: 0; padding: 2.6rem 2.15rem 1.5rem; margin: 0 -2.15rem; }
  .hero::before, .hero::after { display: none; }
  .hero-grid { display: grid; gap: 2.5rem; grid-template-columns: minmax(0, 0.95fr) minmax(320px, 1.05fr); align-items: start; position: relative; z-index: 1; flex: 1; }
  .hero-stats { display: flex; gap: 2rem; flex-wrap: wrap; margin-top: 2.25rem; }
  .hero-stat strong { display: block; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.01em; }
  .hero-stat span { font-size: 0.85rem; color: var(--muted); }
  .gradient-text {
    /* Solid, legible fallback color first. Only browsers that actually
       support clipping the background to the text (near-universal today,
       but not guaranteed) get color: transparent. Without this @supports
       guard, a browser lacking background-clip: text would render fully
       transparent text on a transparent background: an invisible headline. */
    color: var(--accent);
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    -webkit-background-clip: text; background-clip: text;
  }
  @supports (background-clip: text) or (-webkit-background-clip: text) {
    .gradient-text { color: transparent; }
  }
  @media (max-width: 960px) {
    .hero { min-height: 0; }
    .hero-grid { grid-template-columns: 1fr; gap: 2rem; }
    .hero-globe { width: min(140vw, 34rem); right: -32%; top: -6%; opacity: 0.55; }
    .hero-visual { min-height: 0; }
  }

  ul, ol { padding-left: 1.3rem; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .pricing-grid {
    display: grid; gap: 0; grid-template-columns: repeat(3, minmax(0, 1fr));
    border: 1px solid var(--border);
  }
  @media (max-width: 860px) {
    .pricing-grid { grid-template-columns: 1fr; }
  }
  .price-card {
    border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.75rem;
    background: var(--card-bg); box-shadow: var(--shadow-sm);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .price-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
  .price-card.featured { border-color: var(--accent); border-width: 2px; box-shadow: var(--shadow-glow); }
  .price-amount {
    font-family: var(--font-display); font-style: italic; font-weight: 500;
    font-size: 2.45rem; letter-spacing: -0.03em; margin: 0.5rem 0 0.9rem;
  }
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
  .footer-grid { max-width: none; margin: 0; padding: 0; display: grid; gap: 1.75rem; grid-template-columns: 2fr 1fr 1fr 1fr; }
  .footer-grid .brand { font-family: var(--font-display); font-style: italic; font-size: 1.25rem; font-weight: 500; letter-spacing: -0.03em; margin: 0 0 0.6rem; }
  .footer-grid a { display: block; text-decoration: none; color: var(--muted); font-size: 0.9rem; margin-bottom: 0.45rem; }
  .footer-grid a:hover { color: var(--text); }
  .footer-heading { font-weight: 600; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; font-family: var(--font-mono); margin: 0 0 0.7rem; color: var(--muted); }
  .site-footer { border-top: 1px solid var(--border); margin-top: 0; padding: 3rem 2.15rem 2.5rem; background: transparent; }
  .footnote { margin: 1.75rem 0 0; padding-top: 1.25rem; border-top: 1px solid var(--border); }
  @media (max-width: 640px) {
    .footer-grid { grid-template-columns: 1fr 1fr; }
    .nav { flex-direction: column; align-items: flex-start; gap: 0.6rem; padding: 1.05rem 1.15rem 0.95rem; }
    .nav-links { gap: 0.65rem 1rem; }
    main { padding: 0 1.15rem 4rem; }
    .hero { margin: 0 -1.15rem; padding-left: 1.15rem; padding-right: 1.15rem; }
    .hero-inner { padding: 1.85rem 1.15rem 1.15rem; margin: 0 -1.15rem; }
    .site-footer { padding: 2.25rem 1.15rem 2rem; }
  }

  /* Full-bleed tinted band for section rhythm, breaks out of main's padding the same way .hero does. */
  .band {
    margin: 4rem -1.25rem; padding: 3.5rem 1.25rem; background: var(--bg-alt);
  }

  .domain-grid {
    display: grid; gap: 0; grid-template-columns: 1fr 1fr;
    border-top: 1px solid var(--border); margin-top: 1.75rem;
  }
  .domain-tile {
    display: flex; gap: 0.85rem; align-items: flex-start;
    padding: 1.2rem 1.1rem 1.2rem 0; border-bottom: 1px solid var(--border);
    transition: background 0.15s ease;
  }
  .domain-tile:nth-child(odd) { padding-right: 1.4rem; }
  .domain-tile:nth-child(even) { padding-left: 1.4rem; border-left: 1px solid var(--border); }
  .domain-tile .card-icon {
    flex-shrink: 0; margin-bottom: 0; width: 1.7rem; height: 1.7rem; border-radius: 0;
  }
  .domain-tile .card-icon svg { width: 0.9rem; height: 0.9rem; }
  .domain-tile h3 {
    margin-bottom: 0.2rem; font-size: 0.82rem; font-family: var(--font-mono);
    letter-spacing: 0.04em; font-weight: 600;
  }
  .domain-tile p { font-size: 0.9rem; margin-bottom: 0.4rem; color: var(--muted); }
  .domain-prompt-tag {
    display: inline-flex; align-items: center; gap: 0.35rem;
    font-family: var(--font-mono); font-size: 0.7rem; color: var(--gold);
    background: color-mix(in srgb, var(--paper-deep) 65%, transparent);
    padding: 0.15rem 0.45rem; border: 1px solid var(--border);
  }
  @media (max-width: 720px) {
    .domain-grid { grid-template-columns: 1fr; }
    .domain-tile:nth-child(odd), .domain-tile:nth-child(even) { padding-left: 0; padding-right: 0; border-left: none; }
  }

  .chapter-steps {
    list-style: none; padding: 0; margin: 1.75rem 0 0; display: grid;
    grid-template-columns: repeat(3, 1fr); gap: 0; border-top: 1px solid var(--border);
  }
  .chapter-steps li {
    padding: 1.4rem 1.35rem 0.4rem 0; border-right: 1px solid var(--border); margin: 0;
  }
  .chapter-steps li:last-child { border-right: none; padding-right: 0; }
  .step-idx {
    display: block; font-family: var(--font-display); font-style: italic;
    font-size: 1.65rem; color: var(--gold); margin-bottom: 0.55rem; line-height: 1;
  }
  .chapter-steps h3 { margin: 0 0 0.45rem; font-size: 1.05rem; }
  .chapter-steps p { margin: 0; color: var(--muted); }
  @media (max-width: 760px) {
    .chapter-steps { grid-template-columns: 1fr; }
    .chapter-steps li { border-right: none; border-bottom: 1px solid var(--border); padding: 1.2rem 0; }
  }

  .pricing-rail {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 0;
    border: 1px solid var(--border); margin: 1.5rem 0 1.25rem;
  }
  .pricing-rail > div { padding: 1.5rem 1.4rem; border-right: 1px solid var(--border); position: relative; }
  .pricing-rail > div:last-child { border-right: none; }
  .rail-tag {
    display: inline-block; font-family: var(--font-mono); font-size: 0.62rem;
    letter-spacing: 0.08em; text-transform: uppercase; padding: 0.15rem 0.45rem;
    border: 1px solid var(--border); margin-bottom: 0.5rem;
  }
  .rail-tag.highlight { background: var(--ink); color: var(--accent-contrast); border-color: var(--ink); }
  .rail-name { font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 0 0 0.35rem; }
  .pricing-rail .price-amount { font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: 2.4rem; margin: 0 0 0.55rem; }
  @media (max-width: 760px) {
    .pricing-rail { grid-template-columns: 1fr; }
    .pricing-rail > div { border-right: none; border-bottom: 1px solid var(--border); }
  }

  .compare-yes { color: var(--status-good-bg); font-weight: 700; }
  .compare-yes svg { width: 1em; height: 1em; vertical-align: -0.15em; margin-right: 0.3em; }
  .compare-no { color: var(--muted); }

  .step-num { font-weight: 800; font-size: 1.05rem; }

  /* Anchor target for the hero/footer's "quickstart" links. */
  #self-host { scroll-margin-top: 5.5rem; }
  #quickstart { scroll-margin-top: 5.5rem; }
  .quickstart-grid { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); align-items: start; }
  .quickstart-grid .code-window { margin: 0; }
  .steps-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 1.5rem; }

  /* Scroll-reveal progressive enhancement */
  @media (prefers-reduced-motion: no-preference) {
    .js-anim section:not(.hero) { opacity: 0; transform: translateY(18px); transition: opacity 0.5s ease, transform 0.5s ease; }
    .js-anim section:not(.hero).in-view { opacity: 1; transform: none; }
  }
  @media print {
    .js-anim section:not(.hero) { opacity: 1 !important; transform: none !important; }
  }

  .hero-visual { position: relative; min-height: 26rem; z-index: 1; }
  .hero-globe {
    position: absolute; right: -14%; top: 4%; width: min(82vw, 50rem); height: auto;
    color: color-mix(in srgb, var(--text) 22%, transparent); pointer-events: none; z-index: 0;
    mask-image: radial-gradient(closest-side, #000 46%, transparent 76%);
    -webkit-mask-image: radial-gradient(closest-side, #000 46%, transparent 76%);
  }
  .globe-spin { transform-origin: center; transform-box: fill-box; }
  @media (prefers-reduced-motion: no-preference) {
    .globe-spin { animation: globe-turn 110s linear infinite; }
  }
  @keyframes globe-turn { to { transform: rotate(360deg); } }
  .hero-chips {
    display: flex; flex-wrap: wrap; gap: 0.35rem 0; margin-top: 1.75rem;
    font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
  }
  .hero-chips span { display: inline-flex; align-items: center; }
  .hero-chips span + span::before { content: "·"; margin: 0 0.7rem; color: var(--gold); }
  .cta-row { display: flex; gap: 0.85rem; flex-wrap: wrap; align-items: center; }
  .cta-text {
    background: none; border: none; padding: 0.55rem 0.1rem; text-decoration: none;
    color: var(--text); font-weight: 550; box-shadow: inset 0 -1px 0 var(--text);
  }
  .cta-text:hover { color: var(--muted); }

  /* Live Feed Legacy Component (kept for backwards-compatibility) */
  .live-feed {
    background: color-mix(in srgb, var(--bg) 55%, white);
    border: 1px solid var(--border); border-radius: 0;
    padding: 1.05rem 1.05rem 0.85rem; position: relative;
    box-shadow: none;
  }
  .live-feed-title {
    font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--muted); margin: 0 0 0.95rem;
    display: flex; align-items: center; gap: 0.5rem;
  }
  .live-dot {
    width: 0.45rem; height: 0.45rem; border-radius: 50%; background: var(--moss);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--moss) 18%, transparent);
  }
  .live-feed-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0; border-top: 1px solid var(--border); }
  .live-feed-item {
    display: flex; align-items: flex-start; gap: 0.6rem;
    background: transparent;
    border: none; border-bottom: 1px solid var(--border);
    border-radius: 0; padding: 0.72rem 0.1rem; font-size: 0.76rem; margin: 0;
    font-family: var(--font-mono); line-height: 1.45;
    transform: translateY(calc(var(--rise, 0) * -5px));
    transition: opacity 0.55s ease, transform 0.55s cubic-bezier(.22,.61,.36,1), filter 0.55s ease;
  }
  .live-feed-item.is-stale { opacity: 0.42; transform: translateY(-2px); filter: grayscale(0.15); }
  .live-feed-mark {
    flex-shrink: 0; width: 0.85rem; height: 0.85rem; margin-top: 0.18rem; border-radius: 50%;
    border: 1.5px solid var(--border); background: transparent; position: relative;
  }
  .live-feed-item.is-done .live-feed-mark {
    background: var(--moss); border-color: var(--moss);
  }
  .live-feed-item.is-done .live-feed-mark::after {
    content: ""; position: absolute; left: 0.18rem; top: 0.12rem; width: 0.28rem; height: 0.42rem;
    border-right: 1.5px solid var(--bg); border-bottom: 1.5px solid var(--bg); transform: rotate(40deg);
  }
  .live-feed-item.is-typing .live-feed-text::after {
    content: ""; display: inline-block; width: 0.5ch; height: 0.95em; margin-left: 2px;
    background: var(--text); animation: caret 0.9s step-end infinite; vertical-align: -0.12em;
  }
  @keyframes caret { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .live-feed-item.is-typing .live-feed-text::after { display: none; }
    .live-feed-item.is-stale { opacity: 1; transform: none; filter: none; }
  }

  /* ─────────────────────────────────────────────────────────────
     AGENT PREVIEW / MCP INSPECTOR SIMULATOR
     ───────────────────────────────────────────────────────────── */
  .agent-preview {
    background: #141210;
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 20px 48px rgba(22, 18, 14, 0.16);
    overflow: hidden;
    font-family: var(--font-mono);
    color: #ded7cd;
    display: flex;
    flex-direction: column;
    min-height: 27rem;
  }
  .agent-preview-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.55rem 0.85rem;
    background: #0f0d0b;
    border-bottom: 1px solid #29241e;
    font-size: 0.72rem;
  }
  .agent-preview-dots {
    display: flex;
    gap: 0.35rem;
  }
  .agent-dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: #3c342a;
  }
  .agent-dot.red { background: #b84c3c; opacity: 0.8; }
  .agent-dot.yellow { background: #c9953a; opacity: 0.8; }
  .agent-dot.green { background: #4a7550; opacity: 0.8; }
  .agent-preview-server {
    font-weight: 500;
    color: #a89d8d;
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .agent-status-indicator {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 6px #4ade80;
    display: inline-block;
  }
  .agent-preview-tabs {
    display: flex;
    background: #191613;
    border-bottom: 1px solid #29241e;
    overflow-x: auto;
  }
  .agent-tab-btn {
    appearance: none;
    background: transparent;
    border: none;
    border-right: 1px solid #29241e;
    color: #8c8273;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    padding: 0.5rem 0.85rem;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .agent-tab-btn:hover {
    color: #ded7cd;
    background: #201c18;
  }
  .agent-tab-btn.is-active {
    color: #f3eadc;
    background: #141210;
    border-bottom: 2px solid var(--gold);
    font-weight: 500;
  }
  .agent-preview-body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    font-size: 0.77rem;
    line-height: 1.5;
    flex: 1;
  }
  .agent-scenario {
    display: none;
    flex-direction: column;
    gap: 0.85rem;
  }
  .agent-scenario.is-active {
    display: flex;
  }
  .agent-msg {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .agent-msg-role {
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #857a6c;
  }
  .agent-user-prompt {
    background: #1d1915;
    padding: 0.55rem 0.75rem;
    border-radius: 4px;
    border-left: 2px solid var(--gold);
    color: #f5ede1;
  }
  .agent-tool-call {
    background: #181512;
    border: 1px solid #2d261e;
    border-radius: 4px;
    padding: 0.45rem 0.65rem;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    color: #c9953a;
    font-size: 0.73rem;
  }
  .agent-tool-pill {
    background: #2a2218;
    color: #e6be6e;
    padding: 0.1rem 0.35rem;
    border-radius: 2px;
    font-size: 0.68rem;
    border: 1px solid #4a3c26;
  }
  .agent-receipt-card {
    background: #181511;
    border: 1px solid #362e24;
    border-radius: 4px;
    padding: 0.75rem;
  }
  .agent-receipt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding-bottom: 0.5rem;
    margin-bottom: 0.55rem;
    border-bottom: 1px solid #282119;
  }
  .agent-receipt-title {
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #9c9181;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .agent-receipt-tags {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }
  .receipt-tag {
    font-size: 0.64rem;
    padding: 0.12rem 0.35rem;
    border-radius: 2px;
    background: #221c16;
    border: 1px solid #3b3226;
    color: #cfc5b6;
  }
  .receipt-tag.source {
    background: #1d271e;
    border-color: #2e4331;
    color: #8bb893;
  }
  .receipt-tag.confidence {
    background: #2d2618;
    border-color: #554425;
    color: #e5bd68;
    font-weight: 600;
  }
  .agent-receipt-rows {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .agent-receipt-row {
    display: flex;
    justify-content: space-between;
    padding: 0.2rem 0;
    border-bottom: 1px dashed #241e17;
    font-size: 0.72rem;
  }
  .agent-receipt-row:last-child {
    border-bottom: none;
  }
  .agent-receipt-row .val {
    color: #a89d8e;
  }
  .agent-response {
    background: #171411;
    border-left: 2px solid #5a7d61;
    padding: 0.6rem 0.75rem;
    border-radius: 0 4px 4px 0;
    color: #dcd4c7;
    font-size: 0.75rem;
  }
  .agent-preview-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.55rem 0.85rem;
    background: #0f0d0b;
    border-top: 1px solid #29241e;
    font-size: 0.7rem;
    color: #8c8273;
  }
  .agent-copy-prompt {
    appearance: none;
    background: #221d17;
    border: 1px solid #3b3226;
    color: #ded7cd;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.25rem 0.6rem;
    border-radius: 3px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .agent-copy-prompt:hover {
    background: #2d261e;
    border-color: var(--gold);
    color: #f3eadc;
  }

  /* ─────────────────────────────────────────────────────────────
     RECEIPT ANATOMY (4 PILLARS)
     ───────────────────────────────────────────────────────────── */
  .receipt-anatomy-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
    border: 1px solid var(--border);
    margin: 2rem 0;
  }
  .receipt-pillar {
    padding: 1.4rem 1.25rem;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .receipt-pillar:last-child {
    border-right: none;
  }
  .pillar-icon {
    font-size: 1.15rem;
    margin-bottom: 0.2rem;
  }
  .pillar-title {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text);
  }
  .pillar-desc {
    font-size: 0.84rem;
    color: var(--muted);
    line-height: 1.45;
    margin: 0;
  }
  .pillar-code {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--gold);
    background: color-mix(in srgb, var(--paper-deep) 60%, transparent);
    padding: 0.15rem 0.35rem;
    border: 1px solid var(--border);
    width: fit-content;
    margin-top: 0.3rem;
  }
  @media (max-width: 860px) {
    .receipt-anatomy-grid {
      grid-template-columns: 1fr 1fr;
    }
    .receipt-pillar:nth-child(2) {
      border-right: none;
    }
    .receipt-pillar:nth-child(1), .receipt-pillar:nth-child(2) {
      border-bottom: 1px solid var(--border);
    }
  }
  @media (max-width: 520px) {
    .receipt-anatomy-grid {
      grid-template-columns: 1fr;
    }
    .receipt-pillar {
      border-right: none;
      border-bottom: 1px solid var(--border);
    }
    .receipt-pillar:last-child {
      border-bottom: none;
    }
  }

  .deploy-grid { display: grid; gap: 0; grid-template-columns: 1fr 1fr; border: 1px solid var(--border); }
  .deploy-grid > .card { border: none; border-right: 1px solid var(--border); padding: 1.75rem 1.6rem; }
  .deploy-grid > .card:last-child { border-right: none; }
  .deploy-badge {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--border);
    margin-bottom: 0.85rem;
  }
  .deploy-badge.oss {
    background: color-mix(in srgb, var(--moss) 15%, transparent);
    color: var(--moss);
    border-color: var(--moss);
  }
  .deploy-badge.cloud {
    background: color-mix(in srgb, var(--gold) 15%, transparent);
    color: var(--gold);
    border-color: var(--gold);
  }
  @media (max-width: 760px) {
    .deploy-grid { grid-template-columns: 1fr; }
    .deploy-grid > .card { border-right: none; border-bottom: 1px solid var(--border); }
    .deploy-grid > .card:last-child { border-bottom: none; }
  }
  .faq-list {
    border-top: 1px solid var(--border);
    margin-top: 1.25rem;
  }
  .faq details {
    border-bottom: 1px solid var(--border);
    padding: 1.15rem 0;
  }
  .faq summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 1.02rem;
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: var(--text);
    user-select: none;
  }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary::marker { display: none; }
  .faq summary::after {
    content: "+";
    font-family: var(--font-mono);
    font-size: 1.15rem;
    font-weight: 500;
    color: var(--muted);
    flex-shrink: 0;
    width: 1.55rem;
    height: 1.55rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--paper);
    transition: all 0.15s ease;
  }
  .faq summary:hover::after {
    color: var(--text);
    border-color: var(--text);
    background: var(--bg-alt);
  }
  .faq details[open] summary::after {
    content: "−";
    background: var(--bg-alt);
    color: var(--text);
    border-color: var(--border);
  }
  .faq .faq-answer {
    padding-top: 0.65rem;
    padding-right: 3rem;
  }
  .faq p,
  .faq .faq-answer p {
    max-width: none;
    margin: 0 0 0.65rem;
    color: var(--muted);
    font-size: 0.95rem;
    line-height: 1.65;
  }
  .faq .faq-answer p:last-child {
    margin-bottom: 0;
  }

  .ask-ai {
    position: relative; z-index: 1; margin-top: auto; padding: 1.75rem 0 0;
    border-top: none; background: transparent;
  }
  .ask-ai-shell {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
    border: 1px solid var(--border); background: color-mix(in srgb, var(--bg) 70%, white);
    padding: 0.7rem 0.75rem 0.7rem 1.05rem;
    border-radius: 0;
    box-shadow: none;
  }
  .ask-ai-prompt {
    font-family: var(--font-mono); font-size: 0.78rem; color: var(--muted); letter-spacing: 0.02em;
  }
  .ask-ai-models { display: flex; gap: 0.35rem; flex-wrap: wrap; }
  .ask-ai-models a {
    font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.04em;
    text-decoration: none; color: var(--text); padding: 0.4rem 0.7rem;
    border: 1px solid var(--border); border-radius: 0; background: var(--paper);
  }
  .ask-ai-models a:hover { border-color: var(--ink); }

  body.marketing ::selection { background: color-mix(in srgb, var(--gold) 45%, white); color: var(--ink); }
  body.marketing :focus-visible { outline: 1px solid var(--ink); outline-offset: 3px; }

  body.marketing .code-window {
    border-radius: 8px; box-shadow: none; border: 1px solid var(--border); background: #1c1916;
  }
  body.marketing .code-window-bar { background: #161310; }
  body.marketing .code-window-dot { opacity: 0.35; }

  /* Documentation Index & Tool Reference */
  .docs-quickstart {
    margin: 3.5rem 0 4.5rem;
    padding-bottom: 3rem;
    border-bottom: 1px solid var(--border);
  }
  .docs-quickstart-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
    gap: 2.5rem;
    align-items: center;
  }
  @media (max-width: 860px) {
    .docs-quickstart-grid { grid-template-columns: 1fr; }
  }
  .docs-domain-nav {
    margin-top: 1.5rem;
  }
  .docs-domain-nav-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
    margin-bottom: 0.6rem;
  }
  .docs-domain-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }
  .docs-domain-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.65rem;
    border-radius: 4px;
    font-size: 0.82rem;
    font-weight: 500;
    text-decoration: none;
    color: var(--text);
    background: var(--bg-alt);
    border: 1px solid var(--border);
    transition: all 0.15s ease;
  }
  .docs-domain-pill small {
    font-family: var(--font-mono);
    color: var(--muted);
  }
  .docs-domain-pill:hover {
    border-color: var(--text);
    background: var(--paper-deep);
  }
  .docs-domain-section {
    margin: 4.5rem 0;
    scroll-margin-top: 5rem;
  }
  .docs-domain-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 0.8rem;
    border-bottom: 1px solid var(--border);
  }
  .docs-domain-header h2 {
    margin: 0;
  }
  .docs-domain-desc {
    max-width: 36rem;
    font-size: 0.92rem;
    margin: 0;
  }

  /* Tool Cards */
  body.marketing .tool-index-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
  }
  body.marketing .tool-card {
    display: flex;
    flex-direction: column;
    padding: 1.35rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--card-bg);
    text-decoration: none;
    color: inherit;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }
  body.marketing .tool-card:hover {
    transform: translateY(-2px);
    border-color: var(--text);
    box-shadow: var(--shadow-sm);
  }
  .tool-card-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.65rem;
  }
  body.marketing .tool-card .tool-domain {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
  }
  .tool-tier-badge {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.15rem 0.45rem;
    border-radius: 3px;
    border: 1px solid var(--border);
  }
  .tool-tier-badge.free {
    background: color-mix(in srgb, #2e7d32 15%, transparent);
    color: #4caf50;
    border-color: color-mix(in srgb, #2e7d32 35%, transparent);
  }
  .tool-tier-badge.paid {
    background: color-mix(in srgb, var(--gold) 15%, transparent);
    color: var(--gold);
    border-color: color-mix(in srgb, var(--gold) 35%, transparent);
  }
  body.marketing .tool-card h3 {
    margin: 0 0 0.35rem;
    font-size: 1.12rem;
    letter-spacing: -0.01em;
    color: var(--text);
  }
  .tool-code-name {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--muted);
    background: var(--bg-alt);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    margin-bottom: 0.65rem;
    display: inline-block;
    align-self: flex-start;
  }
  .tool-summary {
    font-size: 0.88rem;
    color: var(--muted);
    line-height: 1.5;
    margin: 0 0 0.85rem;
    flex-grow: 1;
  }
  .tool-fact-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.85rem;
  }
  .tool-fact-chip {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    background: var(--bg-alt);
    border: 1px solid var(--border);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    color: var(--muted);
  }
  .tool-fact-chip-more {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--muted);
    align-self: center;
  }
  .tool-card-link {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--accent);
    margin-top: auto;
  }

  /* Tool Detail Page */
  .tool-detail-page {
    max-width: 60rem;
    margin: 0 auto;
    padding: 1.5rem 0 4rem;
  }
  .docs-breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.82rem;
    margin-bottom: 1.75rem;
    color: var(--muted);
  }
  .docs-breadcrumbs a {
    color: var(--muted);
    text-decoration: none;
    transition: color 0.15s ease;
  }
  .docs-breadcrumbs a:hover {
    color: var(--text);
  }
  .docs-breadcrumbs .sep {
    opacity: 0.4;
  }
  .docs-breadcrumbs .current {
    color: var(--text);
    font-family: var(--font-mono);
  }
  .tool-header {
    margin-bottom: 2.5rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--border);
  }
  .tool-header-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 1rem;
  }
  .tool-domain-tag {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
    color: var(--text);
    padding: 0.2rem 0.5rem;
    background: var(--bg-alt);
    border: 1px solid var(--border);
    border-radius: 3px;
  }
  .tool-conn-badge, .tool-status-badge {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: 3px;
    background: var(--bg-alt);
    border: 1px solid var(--border);
    color: var(--muted);
  }
  .tool-conf-badge {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: 3px;
    font-weight: 500;
  }
  .tool-conf-badge.conf-perfect {
    background: color-mix(in srgb, #22c55e 15%, transparent);
    color: #16a34a;
    border: 1px solid color-mix(in srgb, #22c55e 35%, transparent);
  }
  .tool-conf-badge.conf-high {
    background: color-mix(in srgb, #0ea5e9 15%, transparent);
    color: #0284c7;
    border: 1px solid color-mix(in srgb, #0ea5e9 35%, transparent);
  }
  .tool-conf-badge.conf-med {
    background: color-mix(in srgb, #eab308 15%, transparent);
    color: #ca8a04;
    border: 1px solid color-mix(in srgb, #eab308 35%, transparent);
  }
  .tool-conf-badge.conf-low {
    background: color-mix(in srgb, #a855f7 15%, transparent);
    color: #9333ea;
    border: 1px solid color-mix(in srgb, #a855f7 35%, transparent);
  }
  .tool-header h1 {
    margin: 0 0 0.65rem;
    font-size: clamp(2rem, 4vw, 2.75rem);
    letter-spacing: -0.02em;
  }
  .tool-signature {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.88rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    padding: 0.45rem 0.85rem;
    border-radius: 4px;
    color: var(--text);
    margin-bottom: 1.25rem;
    word-break: break-word;
  }
  .tool-lede {
    font-size: 1.15rem;
    line-height: 1.6;
    color: var(--text);
    max-width: 48rem;
    margin: 0 0 0.5rem;
  }
  .tool-sub-lede {
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--muted);
    max-width: 48rem;
    margin: 0 0 1.5rem;
  }
  .tool-subnav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px dashed var(--border);
  }
  .tool-subnav a {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    padding: 0.25rem 0.65rem;
    border-radius: 4px;
    background: var(--bg-alt);
    border: 1px solid var(--border);
    color: var(--muted);
    text-decoration: none;
    transition: all 0.15s ease;
  }
  .tool-subnav a:hover {
    color: var(--text);
    border-color: var(--text);
    background: var(--card-bg);
  }
  .tool-section {
    margin: 3.5rem 0;
    scroll-margin-top: 2rem;
  }
  .section-title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.5rem;
  }
  .section-title-row h2 {
    font-size: 1.4rem;
    letter-spacing: -0.02em;
    margin: 0;
  }
  .section-badge {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .empty-params-card {
    padding: 1.5rem;
    border-radius: 6px;
    border: 1px dashed var(--border);
    background: var(--bg-alt);
    text-align: center;
    color: var(--muted);
  }
  .empty-params-card code {
    font-size: 1.1rem;
    color: var(--text);
  }
  .param-name {
    font-size: 0.88rem;
  }
  .type-code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--muted);
    background: var(--bg-alt);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
  }
  .badge-required {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.15rem 0.45rem;
    border-radius: 3px;
    background: color-mix(in srgb, #e53935 15%, transparent);
    color: #e53935;
    border: 1px solid color-mix(in srgb, #e53935 30%, transparent);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .badge-optional {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.15rem 0.45rem;
    border-radius: 3px;
    background: var(--bg-alt);
    color: var(--muted);
    border: 1px solid var(--border);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .param-meta {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.75rem;
  }
  .param-default {
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }
  .param-constraints {
    color: var(--muted);
    font-size: 0.72rem;
    background: var(--bg-alt);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    display: inline-block;
  }
  .param-desc {
    line-height: 1.5;
    font-size: 0.88rem;
  }
  .envelope-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
    margin-top: 1.25rem;
  }
  .envelope-card {
    padding: 1.25rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--card-bg);
  }
  .envelope-card h3 {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
    font-family: var(--font-mono);
  }
  .envelope-card p {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--muted);
  }
  .fact-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .field-pill {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    background: var(--bg-alt);
    border: 1px solid var(--border);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    color: var(--text);
  }
  .entities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.85rem;
    margin-top: 0.75rem;
  }
  .entity-card {
    padding: 0.85rem 1rem;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: var(--bg-alt);
  }
  .entity-kind-badge {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: var(--card-bg);
    border: 1px solid var(--border);
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    margin-bottom: 0.4rem;
    color: var(--text);
  }
  .entity-card p {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted);
    line-height: 1.4;
  }
  .code-examples-split {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-top: 1rem;
  }
  .code-example-col h3 {
    font-size: 0.92rem;
    font-family: var(--font-mono);
    margin: 0 0 0.5rem;
    color: var(--muted);
  }
  .agent-workflow-card {
    padding: 1.5rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--card-bg);
  }
  .workflow-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.5rem;
  }
  .workflow-header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-family: var(--font-mono);
  }
  .workflow-step-num {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.15rem 0.45rem;
    border-radius: 3px;
    background: var(--bg-alt);
    border: 1px solid var(--border);
    color: var(--muted);
  }
  .workflow-quote {
    margin: 0.5rem 0 0;
    padding: 0.75rem 1rem;
    background: var(--bg-alt);
    border-left: 3px solid var(--accent);
    border-radius: 0 4px 4px 0;
    font-style: italic;
    font-size: 0.92rem;
    color: var(--text);
  }
  .workflow-reasoning {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.55;
    color: var(--muted);
  }
  .workflow-followup-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .followup-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    padding: 0.25rem 0.65rem;
    border-radius: 4px;
    background: var(--bg-alt);
    border: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
    transition: all 0.15s ease;
  }
  .followup-pill:hover {
    border-color: var(--text);
    background: var(--card-bg);
  }
  .provenance-detail-card {
    padding: 1.5rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--card-bg);
  }
  .provenance-meta-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    padding-bottom: 1.25rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--border);
  }
  .muted-label {
    display: block;
    font-size: 0.72rem;
    font-family: var(--font-mono);
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }
  .prov-val {
    font-size: 0.9rem;
    color: var(--text);
  }
  .provenance-desc {
    font-size: 0.88rem;
    line-height: 1.6;
    color: var(--muted);
    margin: 0 0 1.25rem;
  }
  .pricing-rules-box, .error-conditions-box {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border);
  }
  .pricing-rules-box h3, .error-conditions-box h3 {
    margin: 0 0 0.5rem;
    font-size: 0.92rem;
    font-family: var(--font-mono);
  }
  .pricing-rules-box p {
    margin: 0.35rem 0;
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--muted);
  }
  .error-conditions-box ul {
    margin: 0.5rem 0 0;
    padding-left: 1.25rem;
  }
  .error-conditions-box li {
    margin: 0.35rem 0;
    font-size: 0.82rem;
  }
  .sibling-tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1rem;
  }
  .sibling-tool-card {
    display: block;
    padding: 1.15rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--card-bg);
    text-decoration: none;
    color: inherit;
    transition: all 0.15s ease;
  }
  .sibling-tool-card:hover {
    border-color: var(--text);
    transform: translateY(-1px);
  }
  .sibling-card-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }
  .sibling-name {
    font-weight: 600;
    font-size: 0.95rem;
  }
  .sibling-badge {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    padding: 0.1rem 0.35rem;
    border-radius: 2px;
  }
  .sibling-badge.free {
    background: color-mix(in srgb, #22c55e 15%, transparent);
    color: #16a34a;
  }
  .sibling-badge.paid {
    background: var(--bg-alt);
    color: var(--muted);
  }
  .sibling-code {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--muted);
  }
  .sibling-summary {
    font-size: 0.8rem;
    color: var(--muted);
    margin: 0.65rem 0 0;
    line-height: 1.45;
  }
  .tool-cta-row {
    margin: 3.5rem 0 2rem;
  }
  .tool-footer-nav {
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
  }
  .tool-footer-nav a {
    color: var(--muted);
    text-decoration: none;
    font-size: 0.88rem;
    transition: color 0.15s ease;
  }
  .tool-footer-nav a:hover {
    color: var(--text);
  }

  table.compare { border: 1px solid var(--border); min-width: 36rem; }
  .table-scroll { max-width: 100%; }
  @media (max-width: 640px) {
    table.compare { min-width: 32rem; }
    table.compare td:first-child { white-space: normal; }
  }
  table.compare th { background: var(--paper); font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .tool-callouts { list-style: none; padding: 0; margin: 0; max-width: 36rem; }
  .tool-callouts li { border-bottom: 1px solid var(--border); padding: 0.55rem 0; margin: 0; }
`;
