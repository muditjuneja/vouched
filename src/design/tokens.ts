/**
 * The single color system shared by every rendered surface (marketing,
 * dashboard, and anything future). Previously each surface hand-rolled its
 * own palette independently (marketing had 8 semantic custom properties
 * with a `data-theme` override hook; dashboard had 14 scattered short-hex
 * literals passed straight to the native CSS `light-dark()` function with
 * no override hook) — they drifted, and dashboard couldn't be told to
 * ignore the system theme. This is the fix: one token set, one theming
 * mechanism (custom properties + `prefers-color-scheme` + a `data-theme`
 * attribute override), consumed by both.
 *
 * `--status-*` tokens carry what used to be dashboard's hardcoded badge
 * colors (`#1a7f37`/`#9a6700`/`#6e7781`) — same visual values, now defined
 * once instead of embedded in a stylesheet no other surface could reuse.
 *
 * `--accent-2` (a violet paired with the blue `--accent`) backs the
 * gradient text/glow treatment on the marketing hero; `--shadow-*` and
 * `--radius-*` give every card/button/callout consistent depth and
 * corner rounding instead of ad hoc per-component values.
 */
export const TOKENS_CSS = `
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --bg-alt: #f6f7f9;
    --text: #16181d;
    --muted: #5b6270;
    --border: #e3e5ea;
    --accent: #2952e3;
    --accent-2: #7c3aed;
    --accent-contrast: #ffffff;
    --card-bg: #ffffff;
    --status-good-bg: #1a7f37;
    --status-good-text: #ffffff;
    --status-warn-bg: #9a6700;
    --status-warn-text: #ffffff;
    --status-neutral-bg: #6e7781;
    --status-neutral-text: #ffffff;
    --shadow-sm: 0 1px 2px rgba(16, 20, 30, 0.06);
    --shadow-md: 0 8px 24px rgba(16, 20, 30, 0.08);
    --shadow-lg: 0 20px 48px rgba(16, 20, 30, 0.12);
    --shadow-glow: 0 0 0 1px rgba(41, 82, 227, 0.08), 0 8px 24px rgba(41, 82, 227, 0.18);
    --radius-sm: 8px;
    --radius-md: 14px;
    --radius-lg: 20px;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #08090c;
      --bg-alt: #121319;
      --text: #f3f4f8;
      --muted: #9096a6;
      --border: #21232c;
      --accent: #7c9bff;
      --accent-2: #a78bfa;
      --accent-contrast: #08090c;
      --card-bg: #101118;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
      --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.45);
      --shadow-lg: 0 24px 64px rgba(0, 0, 0, 0.55);
      --shadow-glow: 0 0 0 1px rgba(124, 155, 255, 0.15), 0 8px 32px rgba(124, 155, 255, 0.22);
    }
  }
  :root[data-theme="dark"] {
    --bg: #08090c;
    --bg-alt: #121319;
    --text: #f3f4f8;
    --muted: #9096a6;
    --border: #21232c;
    --accent: #7c9bff;
    --accent-2: #a78bfa;
    --accent-contrast: #08090c;
    --card-bg: #101118;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.45);
    --shadow-lg: 0 24px 64px rgba(0, 0, 0, 0.55);
    --shadow-glow: 0 0 0 1px rgba(124, 155, 255, 0.15), 0 8px 32px rgba(124, 155, 255, 0.22);
  }
`;
