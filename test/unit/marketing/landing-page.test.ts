import { describe, expect, it } from "vitest";
import { renderLanding } from "../../../src/marketing/pages/LandingPage";

/**
 * The hero used to show a JSON ExampleCall with two factual bugs
 * (`seo.keyword` instead of `seo.keyword_opportunity`, and invented 0.92
 * confidence). The live feed must still pin the real fact type and
 * search_index's 0.75 default from src/envelope/provenance.ts.
 */
describe("renderLanding: live-feed accuracy", () => {
  const html = renderLanding("https://example.com/", true);

  it("uses the real fact type from research_keywords", () => {
    expect(html).toContain("seo.keyword_opportunity");
    expect(html).toContain("research_keywords");
  });

  it("does not contain the old invented type", () => {
    expect(html).not.toContain("seo.keyword\"");
    expect(html).not.toContain("&quot;seo.keyword&quot;");
  });

  it("uses search_index's real default confidence (0.75), not a made-up number", () => {
    expect(html).toContain("search_index · 0.75");
    expect(html).not.toContain("seo.keyword_opportunity · search_index · 0.92");
  });
});

describe("renderLanding: domain icon grid", () => {
  const html = renderLanding("https://example.com/", true);

  it("renders all 7 domain tiles with a scaled-down, aria-hidden icon each", () => {
    expect(html).toContain("domain-grid");
    for (const domain of ["core", "gsc", "analytics", "seo", "serp", "backlinks", "ai_visibility"]) {
      expect(html).toContain(`<h3>${domain}</h3>`);
    }
    const domainGridStart = html.indexOf('class="domain-grid"');
    const domainGridSection = html.slice(domainGridStart, domainGridStart + 4000);
    expect(domainGridSection).toContain('aria-hidden="true"');
  });
});

describe("renderLanding: story split", () => {
  const html = renderLanding("https://example.com/", true);

  it("sells Cloud and Community as the same tools, different operators", () => {
    expect(html).toContain("Vouched Cloud");
    expect(html).toContain("Self-hosted Community");
    expect(html).toContain("Start on Cloud");
    expect(html).toContain("#self-host");
  });

  it("keeps wrangler / claude mcp add under Community, not the hero", () => {
    const heroEnd = html.indexOf("What the agent can do");
    const hero = html.slice(0, heroEnd);
    expect(hero).not.toContain("wrangler d1 create");
    expect(html).toContain("wrangler d1 create vouched-seo-mcp");
    expect(html).toContain("claude mcp add --transport http vouched-seo-mcp");
  });
});

describe("renderLanding: scroll-reveal robustness", () => {
  const html = renderLanding("https://example.com/", true);

  it("never leaves a section permanently invisible: has a print override and a JS reveal-all fallback", () => {
    expect(html).toContain("@media print");
    expect(html).toMatch(/setTimeout\(function \(\) \{\s*sections\.forEach/);
  });

  it("gradient-text falls back to a solid, legible color if background-clip: text isn't supported", () => {
    expect(html).toContain("@supports (background-clip: text)");
  });
});

describe("renderLanding: dead CSS removed", () => {
  it("no longer ships the unused .wrap utility class", () => {
    const html = renderLanding("https://example.com/", true);
    expect(html).not.toContain(".wrap {");
    expect(html).not.toContain(".band > .wrap");
  });
});
