import { describe, expect, it } from "vitest";
import { renderPricing } from "../../../src/marketing/pages/PricingPage";

/**
 * The comparison table's checkmark cells (`<Yes />`, added in round 2) had
 * no direct assertion beyond the plain-text checks in routes.test.ts —
 * this pins the actual checkmark markup and its accessibility treatment.
 */
describe("renderPricing — comparison table checkmarks", () => {
  const html = renderPricing("https://example.com/pricing");

  it("renders a decorative, aria-hidden check icon next to the word Yes", () => {
    const firstYesIndex = html.indexOf('class="compare-yes"');
    expect(firstYesIndex).toBeGreaterThan(-1);
    const cell = html.slice(firstYesIndex, firstYesIndex + 250);
    expect(cell).toContain('aria-hidden="true"');
    expect(cell).toContain("Yes");
  });

  it("renders at least one Yes cell per plan for the all-18-tools row", () => {
    expect(html.match(/class="compare-yes"/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
