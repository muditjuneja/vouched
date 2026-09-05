import { describe, expect, it } from "vitest";
import { renderLanding } from "../../../src/marketing/pages/LandingPage";

/**
 * The hero's ExampleCall used to be hand-placed <span> literals with two
 * real factual bugs baked in: a fact `type` that doesn't exist
 * (`seo.keyword`, not `seo.keyword_opportunity`) and an invented
 * confidence number (0.92) instead of search_index's real 0.75 default
 * (src/envelope/provenance.ts). It's now generated from a small line/token
 * table — these pin both the real field names (matching
 * src/domains/seo/research-keywords.ts and docs/OFE_ENVELOPE.md) and the
 * absence of the old wrong values, so a future edit can't quietly
 * reintroduce either.
 */
describe("renderLanding — ExampleCall accuracy", () => {
  const html = renderLanding("https://example.com/");

  it("uses the real fact type and the real data field name", () => {
    expect(html).toContain("seo.keyword_opportunity");
    expect(html).toContain("&quot;data&quot;");
    expect(html).toContain("&quot;search_volume&quot;");
  });

  it("does not contain the old invented type or field name", () => {
    expect(html).not.toContain("&quot;seo.keyword&quot;");
    expect(html).not.toContain("&quot;value&quot;");
    expect(html).not.toContain("&quot;volume&quot;");
  });

  it("uses search_index's real default confidence (0.75), not a made-up number", () => {
    expect(html).toContain(">0.75<");
    expect(html).not.toContain(">0.92<");
  });
});

describe("renderLanding — domain icon grid", () => {
  const html = renderLanding("https://example.com/");

  it("renders all 7 domain tiles with a scaled-down, aria-hidden icon each", () => {
    expect(html).toContain("domain-grid");
    for (const domain of ["core", "audit", "seo", "serp", "backlinks", "ai_visibility", "gsc / analytics"]) {
      expect(html).toContain(`<h3>${domain}</h3>`);
    }
    const domainGridStart = html.indexOf('class="domain-grid"');
    const domainGridSection = html.slice(domainGridStart, domainGridStart + 4000);
    expect(domainGridSection).toContain('aria-hidden="true"');
  });

  it("uses a padlock for the closed-source pain point, not the unrelated code-bracket icon", () => {
    const bandStart = html.indexOf("Closed-source scores");
    const cardHtml = html.slice(Math.max(0, bandStart - 400), bandStart);
    expect(cardHtml).toContain("<rect");
  });
});

describe("renderLanding — scroll-reveal robustness", () => {
  const html = renderLanding("https://example.com/");

  it("never leaves a section permanently invisible: has a print override and a JS reveal-all fallback", () => {
    expect(html).toContain("@media print");
    expect(html).toMatch(/setTimeout\(function \(\) \{\s*sections\.forEach/);
  });

  it("gradient-text falls back to a solid, legible color if background-clip: text isn't supported", () => {
    expect(html).toContain("@supports (background-clip: text)");
  });
});

describe("renderLanding — dead CSS removed", () => {
  it("no longer ships the unused .wrap utility class", () => {
    const html = renderLanding("https://example.com/");
    expect(html).not.toContain(".wrap {");
    expect(html).not.toContain(".band > .wrap");
  });
});
