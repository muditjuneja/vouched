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
    --accent-contrast: #ffffff;
    --card-bg: #ffffff;
    --status-good-bg: #1a7f37;
    --status-good-text: #ffffff;
    --status-warn-bg: #9a6700;
    --status-warn-text: #ffffff;
    --status-neutral-bg: #6e7781;
    --status-neutral-text: #ffffff;
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
`;
