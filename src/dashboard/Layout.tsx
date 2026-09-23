import type { PropsWithChildren } from "hono/jsx";
import { BASE_CSS, FAVICON_HREF, TOKENS_CSS, renderToString } from "../design";
import { DISPLAY_NAME } from "../lib/product";
import { Sidebar } from "./components/Sidebar";

import { DASHBOARD_CSS } from "./styles";


export interface LayoutProps {
  title: string;
  activePath: string;
  user?: import("./types").DashboardUser;
  notice?: import("./types").ActionNotice | null;
  breadcrumbs?: { label: string; href?: string }[];
  hideSidebar?: boolean;
}

function FlashAlert({ notice }: { notice: import("./types").ActionNotice }) {
  const typeClass = notice.type === "success" ? "dash-alert-success" : notice.type === "warn" ? "dash-alert-warn" : "dash-alert-info";
  return (
    <div class={`dash-alert ${typeClass}`} role="status">
      <span>{notice.message}</span>
    </div>
  );
}

function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav class="dash-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, idx) => (
        <>
          {idx > 0 ? <span class="sep">/</span> : null}
          {item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}
        </>
      ))}
    </nav>
  );
}

function Layout({ title, activePath, user, notice, breadcrumbs, hideSidebar, children }: PropsWithChildren<LayoutProps>) {
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
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,600&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600;700&display=swap"
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
          {hideSidebar ? (
            <div class="dash-auth-shell">
              {children}
            </div>
          ) : (
            <>
              {/* Mobile-only hamburger; CSS-only via the [open] ~ sibling
                  selector below, no script. Irrelevant on desktop, where
                  .dash-mobile-toggle is display: none and .dash-sidebar is
                  just always visible. */}
              <details class="dash-mobile-toggle">
                <summary />
              </details>
              <div class="dash-shell">
                <Sidebar activePath={activePath} user={user} />
                <main class="dash-main dash-content">
                  {notice ? <FlashAlert notice={notice} /> : null}
                  {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
                  {children}
                </main>
              </div>
            </>
          )}
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-copy]');
  if (!btn) return;
  var text = btn.getAttribute('data-copy');
  if (!text) return;
  navigator.clipboard.writeText(text).then(function() {
    var orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(function() {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 2000);
  });
});
`
          }}
        />
      </body>
    </html>
  );
}

/** Every dashboard page renders through this: one page-level `<h1>` inside `children`, matching the same rule marketing's Layout enforces. */
export function renderPage(props: PropsWithChildren<LayoutProps>): string {
  return "<!doctype html>" + renderToString(<Layout {...props} />);
}

