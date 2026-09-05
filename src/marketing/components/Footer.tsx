export interface FooterProps {
  /** When false (the self-host default), "Cloud dashboard" would link to a dead `/dashboard` 404 (see src/dashboard/routes.ts's gate), so it's swapped for a link to the on-page quickstart instead. */
  cloudMode: boolean;
}

export function Footer({ cloudMode }: FooterProps) {
  return (
    <footer class="site-footer">
      <div class="footer-grid">
        <div>
          <p class="brand">mcp-seo-toolkit</p>
          <p class="muted">
            An open-source (MIT), self-hostable MCP server for SEO and marketing data: keyword research, backlinks, SERP, AI-visibility,
            technical audits, and your own Search Console/Analytics, callable directly from an MCP client.
          </p>
        </div>
        <div>
          <p class="footer-heading">Product</p>
          <a href="/pricing">Pricing</a>
          <a href="/tools">All tools</a>
          {cloudMode ? <a href="/dashboard">Cloud dashboard</a> : <a href="/#quickstart">Self-host guide</a>}
        </div>
        <div>
          <p class="footer-heading">Compare</p>
          <a href="/vs/ahrefs">vs Ahrefs</a>
          <a href="/vs/semrush">vs Semrush</a>
          <a href="/vs/open-seo">vs OpenRush</a>
        </div>
        <div>
          <p class="footer-heading">Use cases</p>
          <a href="/for/agencies">For agencies</a>
          <a href="/for/indie-hackers">For indie hackers</a>
        </div>
      </div>
      <p class="muted footnote">
        MIT licensed. Self-host it for free, or run the hosted version. <a href="/sitemap.xml">Sitemap</a>
      </p>
    </footer>
  );
}
