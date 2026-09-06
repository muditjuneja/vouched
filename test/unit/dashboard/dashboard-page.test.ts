import { describe, expect, it } from "vitest";
import { renderDashboard } from "../../../src/dashboard/pages/DashboardPage";
import type { DashboardData } from "../../../src/dashboard/types";

function fakeData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    websites: [],
    plan: "free",
    usageUsd: 0,
    quotaUsd: 0,
    apiKeys: [],
    googleOAuthConfigured: false,
    dodoConfigured: false,
    ...overrides
  };
}

describe("renderDashboard", () => {
  it("renders exactly one <h1> even though it composes three sections", () => {
    const html = renderDashboard(fakeData());
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    // each section still gets its own heading, one level down.
    expect((html.match(/<h2/g) ?? []).length).toBe(3);
    expect(html).toContain('class="dash"');
    expect(html).toContain("Cloud");
  });

  it("lists a tracked website with escaped, tenant-controlled text safe from injection", () => {
    const html = renderDashboard(
      fakeData({
        websites: [
          {
            row: {
              website_id: "w1",
              name: "<script>alert(1)</script>",
              primary_domain: "example.com",
              is_default: 0,
              gsc_site_url: null,
              ga4_property_id: null,
              tenant_id: "t1",
              created_at: "2026-01-01"
            },
            gsc: "not_configured",
            ga4: "not_configured"
          }
        ]
      })
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
