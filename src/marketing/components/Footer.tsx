import { DISPLAY_NAME } from "../brand";

export interface FooterProps {
  /** When false (the self-host default), "Cloud dashboard" would link to a dead `/dashboard` 404 (see src/dashboard/routes.ts's gate), so it's swapped for a link to the on-page self-host section instead. */
  cloudMode: boolean;
}

export function Footer({ cloudMode }: FooterProps) {
  return (
    <footer class="site-footer">
      <div class="footer-grid">
        <div>
          <p class="brand">{DISPLAY_NAME}</p>
          <p class="muted">
            An open-source (MIT) MCP server for SEO and marketing data: keyword research, backlinks, SERP, AI-visibility, technical
            audits, and your own Search Console/Analytics, callable from an MCP client. Same tools on Cloud or self-host.
          </p>
        </div>
        <div>
          <p class="footer-heading">Product</p>
          <a href="/pricing">Pricing</a>
          <a href="/tools">All tools</a>
          {cloudMode ? <a href="/dashboard">Cloud dashboard</a> : <a href="/#self-host">Self-host guide</a>}
        </div>
        <div>
          <p class="footer-heading">Compare</p>
          <a href="/vs/open-seo">vs OpenRush</a>
          <a href="/vs/ahrefs">vs Ahrefs</a>
          <a href="/vs/semrush">vs Semrush</a>
        </div>
        <div>
          <p class="footer-heading">Use cases</p>
          <a href="/for/agencies">For agencies</a>
          <a href="/for/indie-hackers">For indie hackers</a>
        </div>
      </div>
      <p class="muted footnote">
        MIT licensed. Self-host Community for free, or run Vouched Cloud. <a href="/sitemap.xml">Sitemap</a>
      </p>
    </footer>
  );
}
