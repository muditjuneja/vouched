import { describe, expect, it } from "vitest";
import { renderOverview } from "../../../src/dashboard/pages/OverviewPage";
import type { OverviewData } from "../../../src/dashboard/types";

function fakeData(overrides: Partial<OverviewData> = {}): OverviewData {
  return {
    plan: "free",
    status: null,
    currentPeriodEnd: null,
    usageUsd: 0,
    quotaUsd: 0,
    walletBalanceUsd: 0,
    websiteCount: 0,
    recentActivity: [],
    dodoConfigured: false,
    hasDodoCustomer: false,
    ...overrides
  };
}

describe("renderOverview", () => {
  it("renders exactly one <h1>", () => {
    const html = renderOverview(fakeData());
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toContain('class="dash"');
  });

  it("shows an empty state when there's no recent activity", () => {
    const html = renderOverview(fakeData());
    expect(html).toContain("No activity yet");
  });

  it("lists recent cost-log rows, escaping tenant-controlled text safely", () => {
    const html = renderOverview(
      fakeData({
        recentActivity: [
          { id: 1, tool_name: "<script>alert(1)</script>", endpoint: "/v3/x", cost_usd: 0.01, called_at: "2026-01-01", tenant_id: "t1" }
        ]
      })
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("shows the payment-status warning when a payment has failed", () => {
    const html = renderOverview(fakeData({ status: "on_hold", currentPeriodEnd: "2026-01-01T00:00:00Z" }));
    expect(html).toContain("Your last payment failed");
  });

  it("shows no payment-status warning when the subscription is active", () => {
    const html = renderOverview(fakeData({ status: "active" }));
    expect(html).not.toContain("Your last payment failed");
  });
});
