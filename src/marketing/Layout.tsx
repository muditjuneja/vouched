import type { PropsWithChildren } from "hono/jsx";
import { BASE_CSS, FAVICON_HREF, TOKENS_CSS, renderToString } from "../design";
import { DISPLAY_NAME } from "./brand";
import { Footer } from "./components/Footer";
import { Nav } from "./components/Nav";
import { MARKETING_CSS } from "./styles";

const SCROLL_REVEAL_SCRIPT = `
(function () {
  if (!window.IntersectionObserver) return;
  document.documentElement.classList.add('js-anim');
  var sections = document.querySelectorAll('main section:not(.hero)');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  sections.forEach(function (s) { io.observe(s); });
  // Safety net, not a content gate: a section that never scrolls into view
  // in a live browser tab (a full-page screenshot/archival tool that never
  // dispatches real scroll events, an unusual navigation path) must still
  // end up visible. A normal scrolling reader always triggers the observer
  // well before this fires, so the progressive-reveal effect is unaffected.
  window.setTimeout(function () {
    sections.forEach(function (s) { s.classList.add('in-view'); });
    io.disconnect();
  }, 1500);
})();
`;

export interface LayoutProps {
  /** Full `<title>` text, already specific to the page, e.g. "Pricing · Vouched". */
  title: string;
  /** Goes verbatim into `<meta name="description">`, keep it real and specific per page. */
  description: string;
  /** Absolute URL for `<link rel="canonical">`. */
  canonicalUrl: string;
  /** Whether this deployment has cloud mode enabled (`isCloudMode(c.env)`), threaded down into `Nav`/`Footer` so neither ever links to a `/dashboard` 404 on a self-host-only deployment. */
  cloudMode: boolean;
  /** Whether the visitor looks signed in (see looksSignedIn): the nav's Cloud button becomes Dashboard. */
  signedIn?: boolean;
}

function Layout({ title, description, canonicalUrl, cloudMode, signedIn = false, children }: PropsWithChildren<LayoutProps>) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="icon" href={FAVICON_HREF} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,600&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/brand/icon-180.png" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={DISPLAY_NAME} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={`${new URL(canonicalUrl).origin}/og.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={`${DISPLAY_NAME}: SEO facts your AI can cite`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${new URL(canonicalUrl).origin}/og.png`} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <style dangerouslySetInnerHTML={{ __html: TOKENS_CSS + BASE_CSS + MARKETING_CSS }} />
      </head>
      <body class="marketing">
        <div class="sheet">
          <span class="sheet-tick tl" />
          <span class="sheet-tick tr" />
          <span class="sheet-tick bl" />
          <span class="sheet-tick br" />
          <Nav cloudMode={cloudMode} signedIn={signedIn} />
          <main>{children}</main>
          <Footer cloudMode={cloudMode} />
        </div>
        <script dangerouslySetInnerHTML={{ __html: SCROLL_REVEAL_SCRIPT }} />
      </body>
    </html>
  );
}

/** Every marketing page renders through this: `children` must contain exactly one `<h1>` (each page's own tests assert this). */
export function renderPage(props: PropsWithChildren<LayoutProps>): string {
  return "<!doctype html>" + renderToString(<Layout {...props} />);
}
