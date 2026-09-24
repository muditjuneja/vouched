import { describe, expect, it } from "vitest";
import { BillingSection } from "../../../src/dashboard/components/BillingSection";
import { TeamSection } from "../../../src/dashboard/components/TeamSection";
import { renderInvite, type InvitePageData } from "../../../src/dashboard/pages/InvitePage";
import type { BillingData, TeamSettings } from "../../../src/dashboard/types";
import { renderToString } from "../../../src/design";

function team(overrides: Partial<TeamSettings> = {}): TeamSettings {
  return {
    role: "owner",
    seatLimit: 5,
    ownerEmail: "owner@example.com",
    members: [{ userId: "user_2", email: "member@example.com", joinedAt: "2026-09-01T00:00:00Z" }],
    pendingInvites: [{ inviteId: "inv_1", email: "pending@example.com", expiresAt: "2026-10-01T00:00:00Z" }],
    canInvite: true,
    pausedTeamOwnerEmail: null,
    ...overrides
  };
}

describe("TeamSection", () => {
  it("shows the owner seat use, remove/withdraw actions and the invite form", () => {
    const html = renderToString(<TeamSection team={team()} />);
    expect(html).toContain("3 of 5 seats used");
    expect(html).toContain("/dashboard/team/members/user_2/remove");
    expect(html).toContain("/dashboard/team/invites/inv_1/revoke");
    expect(html).toContain('action="/dashboard/team/invites"');
    expect(html).not.toContain("/dashboard/team/leave");
  });

  it("swaps the invite form for a full-seats note when every seat is taken", () => {
    const html = renderToString(<TeamSection team={team({ canInvite: false, seatLimit: 3 })} />);
    expect(html).not.toContain('action="/dashboard/team/invites"');
    expect(html).toContain("All seats are taken");
  });

  it("gives a member only a leave button: no remove, no invites, no pending list", () => {
    const html = renderToString(<TeamSection team={team({ role: "member" })} />);
    expect(html).toContain("/dashboard/team/leave");
    expect(html).not.toContain("/remove");
    expect(html).not.toContain("pending@example.com");
    expect(html).not.toContain('action="/dashboard/team/invites"');
  });

  it("explains a paused team instead of listing it", () => {
    const html = renderToString(<TeamSection team={team({ pausedTeamOwnerEmail: "owner@example.com" })} />);
    expect(html).toContain("on the Team plan right now");
    expect(html).toContain("/dashboard/team/leave");
    expect(html).not.toContain("seats used");
  });

  it("escapes emails, which come from user input", () => {
    const html = renderToString(<TeamSection team={team({ pendingInvites: [{ inviteId: "i", email: "<script>x</script>", expiresAt: "2026-10-01" }] })} />);
    expect(html).not.toContain("<script>x</script>");
  });
});

function billing(overrides: Partial<BillingData> = {}): BillingData {
  return {
    plan: "pro",
    status: "active",
    currentPeriodEnd: null,
    usageUsd: 2,
    quotaUsd: 10,
    walletBalanceUsd: 5,
    walletLedger: [],
    dodoConfigured: true,
    hasDodoCustomer: true,
    checkoutSuccess: false,
    topupSuccess: false,
    prefillEmail: "owner@example.com",
    canManageBilling: true,
    ...overrides
  };
}

describe("BillingSection", () => {
  it("offers a paid owner top-ups and the customer portal", () => {
    const html = renderToString(<BillingSection data={billing()} />);
    expect(html).toContain("/billing/topup");
    expect(html).toContain("/billing/portal");
  });

  it("never offers a free plan a top-up, since the wallet only pays for market data", () => {
    const html = renderToString(<BillingSection data={billing({ plan: "free", walletBalanceUsd: 0 })} />);
    expect(html).not.toContain("/billing/topup");
    expect(html).toContain("available on Pro and Team");
  });

  it("shows a member the plan but no way to change it or pay", () => {
    const html = renderToString(<BillingSection data={billing({ plan: "team", canManageBilling: false })} />);
    expect(html).toContain("Only the workspace owner");
    expect(html).not.toContain("/billing/topup");
    expect(html).not.toContain("/billing/portal");
    expect(html).not.toContain("/billing/checkout");
  });
});

describe("renderInvite", () => {
  const base: InvitePageData = {
    token: "tok_abc",
    ownerEmail: "owner@example.com",
    inviteEmail: "bob@example.com",
    userEmail: "bob@example.com",
    blocker: null
  };

  it("offers a join button when nothing blocks the invite", () => {
    const html = renderInvite(base);
    expect(html).toContain("/dashboard/invite/tok_abc/accept");
    expect(html).toContain("owner@example.com");
  });

  it("names both addresses when the wrong account opens the link, with no join button", () => {
    const html = renderInvite({ ...base, blocker: "wrong_email", userEmail: "mallory@example.com" });
    expect(html).toContain("bob@example.com");
    expect(html).toContain("mallory@example.com");
    expect(html).not.toContain("/accept");
  });

  it("tells someone on a paid plan to cancel first", () => {
    expect(renderInvite({ ...base, blocker: "has_paid_plan" })).toContain("Cancel it from Billing first");
  });
});
