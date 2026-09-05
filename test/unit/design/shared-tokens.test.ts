import { describe, expect, it } from "vitest";
import { renderDashboard } from "../../../src/dashboard/pages/DashboardPage";
import { renderLanding } from "../../../src/marketing/pages/LandingPage";
import { TOKENS_CSS } from "../../../src/design/tokens";

/**
 * Proves marketing and the dashboard actually share one design system
 * instead of each hand-rolling its own colors (the drift this whole
 * rewrite fixed); both rendered pages must embed the exact same
 * TOKENS_CSS block, not two independently-defined `--accent` values.
 */
describe("shared design tokens", () => {
  it("both surfaces embed the identical TOKENS_CSS block", () => {
    const dashboardHtml = renderDashboard({
      websites: [],
      plan: "free",
      usageUsd: 0,
      quotaUsd: 0,
      apiKeys: [],
      googleOAuthConfigured: false,
      dodoConfigured: false
    });
    const marketingHtml = renderLanding("https://example.com/", true);

    expect(dashboardHtml).toContain(TOKENS_CSS);
    expect(marketingHtml).toContain(TOKENS_CSS);
  });
});
