import { describe, expect, it } from "vitest";
import { renderPricing } from "../../../src/marketing/pages/PricingPage";

/**
 * The comparison table's checkmark cells (`<Yes />`, added in round 2) had
 * no direct assertion beyond the plain-text checks in routes.test.ts;
 * this pins the actual checkmark markup and its accessibility treatment.
 */
describe("renderPricing: comparison table checkmarks", () => {
  const html = renderPricing("https://example.com/pricing", true);

  it("renders a decorative, aria-hidden check icon next to the word Yes", () => {
    const firstYesIndex = html.indexOf('class="compare-yes"');
    expect(firstYesIndex).toBeGreaterThan(-1);
    const cell = html.slice(firstYesIndex, firstYesIndex + 250);
    expect(cell).toContain('aria-hidden="true"');
    expect(cell).toContain("Yes");
  });

  it("renders a Yes cell for every plan on the Google-tools row", () => {
    expect(html.match(/class="compare-yes"/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

describe("renderPricing: facts match the product", () => {
  const html = renderPricing("https://example.com/pricing", true);

  it("counts tools from the manifest: 7 Google tools, 12 market-data tools", () => {
    expect(html).toContain("7 tools for your Search Console and GA4 data");
    expect(html).toContain("12 keyword, backlink, SERP and AI-visibility tools");
    expect(html).toContain("Market-data tools (12)");
  });

  it("is honest that Free has no market data, and names the real limits and markup", () => {
    expect(html).toMatch(/Market-data tools \(12\)<\/td><td><span class="compare-no">No<\/span>/);
    expect(html).toContain("Up to 100 tool calls a day, 10 a minute");
    expect(html).toContain("cost plus 15%");
  });

  it("drops the old claims that were wrong", () => {
    expect(html).not.toContain("18 tools");
    expect(html).not.toContain("talk to us");
    expect(html).not.toContain("quotas.ts");
  });
});
