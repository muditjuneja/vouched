import { describe, expect, it } from "vitest";
import { renderToString } from "../../../src/design/render";
import { Footer } from "../../../src/marketing/components/Footer";
import { Nav } from "../../../src/marketing/components/Nav";
import { PricingCard } from "../../../src/marketing/components/PricingCard";
import { ToolCard } from "../../../src/marketing/components/ToolCard";
import { CheckIcon, LockIcon, SearchIcon } from "../../../src/marketing/components/icons";

/**
 * Round 2 added/changed these components (Nav's Sign-in button, the icon
 * set, PricingCard/ToolCard) with no direct unit coverage of their own;
 * only indirect coverage through full-page route tests. These pin the
 * actual markup so a future edit can't silently drop the sign-in link,
 * break a card link, or regress the decorative-icon accessibility fix.
 */
describe("Nav", () => {
  it("links Docs, Pricing, vs OpenRush, and Cloud when cloudMode is on", () => {
    const html = renderToString(<Nav cloudMode />);
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/docs"');
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('href="/vs/open-seo"');
    expect(html).toContain('class="btn" href="/dashboard"');
    expect(html).toContain("Cloud");
    expect(html).toContain("Vouched");
  });
});

describe("Footer", () => {
  it("links every product/compare/use-case route it advertises", () => {
    const html = renderToString(<Footer cloudMode />);
    for (const href of ["/pricing", "/docs", "/dashboard", "/vs/ahrefs", "/vs/semrush", "/vs/open-seo", "/for/agencies", "/for/indie-hackers", "/sitemap.xml"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });
});

describe("PricingCard", () => {
  it("renders name, price, note, and CTA", () => {
    const html = renderToString(
      <PricingCard name="Pro (cloud)" price="$10" priceNote="/mo" ctaLabel="Start on Pro" ctaHref="/dashboard" featured primaryCta>
        <p>desc</p>
      </PricingCard>
    );
    expect(html).toContain("price-card featured");
    expect(html).toContain("Pro (cloud)");
    expect(html).toContain("$10");
    expect(html).toContain("Start on Pro");
    expect(html).toContain("btn-primary");
  });
});

describe("ToolCard", () => {
  it("renders as a linked card with domain label, title, and summary", () => {
    const html = renderToString(<ToolCard href="/tools/audit-site" domainLabel="Technical Audit" title="Audit Site" summary="Fast health audit." />);
    expect(html).toContain('href="/tools/audit-site"');
    expect(html).toContain("Technical Audit");
    expect(html).toContain("Audit Site");
    expect(html).toContain("Fast health audit.");
  });
});

describe("decorative icons", () => {
  it("every icon's <svg> carries aria-hidden so screen readers skip purely decorative glyphs", () => {
    for (const html of [renderToString(<SearchIcon />), renderToString(<LockIcon />), renderToString(<CheckIcon />)]) {
      expect(html).toContain('aria-hidden="true"');
    }
  });

  it("LockIcon (not CodeIcon's <> brackets) represents the closed-source pain point", () => {
    // A padlock shape: a body rect plus a shackle path, not the code-bracket polylines.
    const html = renderToString(<LockIcon />);
    expect(html).toContain("<rect");
    expect(html).not.toContain("polyline");
  });
});
