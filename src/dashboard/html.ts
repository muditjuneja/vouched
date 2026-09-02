/**
 * Plain string-template HTML rendering — no JSX toolchain to configure or
 * verify unrun in this sandbox, and full control over escaping. Every
 * value that could contain tenant-controlled text (a website name, an API
 * key label) MUST go through `esc()` before being interpolated; static
 * markup/labels don't need it.
 */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — mcp-seo-toolkit</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         max-width: 760px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
  header { display: flex; align-items: baseline; justify-content: space-between;
           border-bottom: 1px solid light-dark(#0002, #fff2); padding-bottom: 0.75rem; margin-bottom: 1.5rem; }
  header a { text-decoration: none; font-weight: 600; }
  h1 { font-size: 1.3rem; margin: 1.75rem 0 0.5rem; }
  h1:first-of-type { margin-top: 0; }
  section { margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid light-dark(#0001, #fff1); font-size: 0.92rem; }
  th { font-weight: 600; opacity: 0.7; }
  .badge { display: inline-block; padding: 0.1rem 0.55rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; }
  .badge-connected { background: #1a7f37; color: #fff; }
  .badge-reconnect { background: #9a6700; color: #fff; }
  .badge-not_connected { background: light-dark(#6e7781, #6e7781); color: #fff; }
  form.inline { display: inline-block; margin: 0; }
  input, select { font: inherit; padding: 0.4rem 0.55rem; border-radius: 6px; border: 1px solid light-dark(#0003, #fff3); background: transparent; color: inherit; }
  button { font: inherit; padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid light-dark(#0003, #fff3);
           background: light-dark(#0000, #fff1); color: inherit; cursor: pointer; }
  button:hover { background: light-dark(#0001, #fff2); }
  code, .key { background: light-dark(#0000, #fff1); padding: 0.15rem 0.4rem; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 0.88rem; word-break: break-all; }
  .muted { opacity: 0.65; font-size: 0.9rem; }
  .callout { border: 1px solid light-dark(#9a6700, #d29b1f); background: light-dark(#9a67001a, #d29b1f22); border-radius: 8px; padding: 0.9rem 1rem; margin-bottom: 1.5rem; }
  .row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
</style>
</head>
<body>
<header>
  <a href="/dashboard">mcp-seo-toolkit</a>
  <span class="muted">Cloud dashboard</span>
</header>
<main>
${bodyHtml}
</main>
</body>
</html>`;
}
