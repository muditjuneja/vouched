import type { PropsWithChildren } from "hono/jsx";
import { BASE_CSS, FAVICON_HREF, TOKENS_CSS, renderToString } from "../design";

/**
 * Layout-only CSS genuinely specific to the dashboard's narrow,
 * authenticated control-panel shape — everything else (colors, type
 * scale, buttons, badges, tables, forms) comes from src/design's shared
 * tokens/base styles. See src/marketing/Layout.tsx for the other surface's
 * (wide, public) equivalent.
 */
const DASHBOARD_CSS = `
  body { max-width: 760px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
  header {
    display: flex; align-items: baseline; justify-content: space-between;
    border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; margin-bottom: 1.5rem;
  }
  header a { text-decoration: none; font-weight: 600; color: var(--text); }
  section { margin-bottom: 1.5rem; }
  form.inline { display: inline-block; margin: 0; }
  .row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
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
        <title>{title} — mcp-seo-toolkit</title>
        <link rel="icon" href={FAVICON_HREF} />
        <style dangerouslySetInnerHTML={{ __html: TOKENS_CSS + BASE_CSS + DASHBOARD_CSS }} />
      </head>
      <body>
        <header>
          <a href="/dashboard">mcp-seo-toolkit</a>
          <span class="muted">Cloud dashboard</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

/** Every dashboard page renders through this — one page-level `<h1>` inside `children`, matching the same rule marketing's Layout enforces. */
export function renderPage(props: PropsWithChildren<LayoutProps>): string {
  return "<!doctype html>" + renderToString(<Layout {...props} />);
}
