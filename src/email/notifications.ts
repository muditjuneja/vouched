import { getTenantEmail } from "../auth/clerk";
import type { ScopeGroup } from "../db/google-tokens";
import type { Plan } from "../db/subscriptions";
import type { Env } from "../types/env";
import { sendEmail } from "./client";
import { DISPLAY_NAME, SITE_URL } from "../lib/product";
import { FREE_DAILY_TOOL_CALLS, OVERAGE_MARKUP_MULTIPLIER, TEAM_INVITE_TTL_DAYS } from "../billing/quotas";
import { PAYMENT_FAILURE_GRACE_DAYS } from "../db/subscriptions";

/**
 * Every function here resolves the tenant's email itself (via Clerk, see
 * getTenantEmail's doc comment for why) and never throws: a null email, a
 * disabled email config, or a delivery failure all just mean "this
 * notification didn't go out", logged, not a broken caller flow.
 */
async function sendToTenant(env: Env, tenantId: string, subject: string, html: string): Promise<boolean> {
  const to = await getTenantEmail(env, tenantId);
  if (!to) {
    console.warn(`[email] no email on file for tenant ${tenantId}, skipping "${subject}"`);
    return false;
  }
  return sendEmail(env, { to, subject, html });
}

/** Anything user-supplied (a key label, an email address) goes through this before landing in email HTML. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const PLAN_NAME: Record<Plan, string> = { free: "Free", pro: "Pro", team: "Team" };
const OVERAGE_MARKUP_PCT = Math.round((OVERAGE_MARKUP_MULTIPLIER - 1) * 100);

/** `dashboardPath` is where the email's "from the dashboard" points, as a real link; null for emails that carry their own link. */
function wrap(title: string, bodyHtml: string, dashboardPath: string | null = "/dashboard"): string {
  const link = dashboardPath ? `<p><a href="${SITE_URL}${dashboardPath}">Open ${DISPLAY_NAME}</a></p>` : "";
  return `<h1>${title}</h1>${bodyHtml}${link}<p>${DISPLAY_NAME}</p>`;
}

/** Sent on a tenant's first dashboard visit, see the dashboard route's markNotifiedOnce("welcome") gate. */
export async function notifyWelcome(env: Env, tenantId: string): Promise<boolean> {
  return sendToTenant(
    env,
    tenantId,
    `Welcome to ${DISPLAY_NAME}`,
    wrap(
      "Welcome aboard",
      `<p>Your account is ready, on the Free plan: your own Search Console and GA4 data, up to ${FREE_DAILY_TOOL_CALLS} tool calls a day.</p>` +
        "<p>To get going, add a website and connect Google, then create an API key and add it to Claude or any other MCP client.</p>" +
        "<p>Keyword, backlink, SERP and AI-visibility data come with Pro and Team.</p>"
    )
  );
}

/** Sent every time an MCP API key is created: issuance and rotation both go through the same call. */
export async function notifyApiKeyIssued(env: Env, tenantId: string, label: string | null): Promise<boolean> {
  const labelText = label ? ` ("${escapeHtml(label)}")` : "";
  return sendToTenant(
    env,
    tenantId,
    "A new API key was created on your account",
    wrap(
      "New API key created",
      `<p>A new MCP API key${labelText} was just created for your account. If this wasn't you, revoke it right away on the API keys page and replace your other keys too.</p>`,
      "/dashboard/api-keys"
    )
  );
}

const SCOPE_LABEL: Record<ScopeGroup, string> = {
  webmaster_console: "Search Console",
  analytics_property: "Google Analytics"
};

/** Sent when a connected Google account's refresh token has been revoked/expired, see checkConnectionState's "reconnect_required". */
export async function notifyReconnectRequired(env: Env, tenantId: string, scope: ScopeGroup): Promise<boolean> {
  return sendToTenant(
    env,
    tenantId,
    `Reconnect your ${SCOPE_LABEL[scope]} account`,
    wrap(
      "Reconnection needed",
      `<p>Your ${SCOPE_LABEL[scope]} connection has stopped working, likely because access was revoked or expired. Reconnect it from Settings to keep that data flowing.</p>`,
      "/dashboard/settings"
    )
  );
}

export async function notifyPaymentReceipt(env: Env, tenantId: string, plan: Plan): Promise<boolean> {
  return sendToTenant(
    env,
    tenantId,
    "Payment received",
    wrap("Payment received", `<p>Thanks, your ${PLAN_NAME[plan]} plan is active. Invoices, payment method and cancellation are under Billing.</p>`, "/dashboard/billing")
  );
}

export async function notifyPaymentFailed(env: Env, tenantId: string): Promise<boolean> {
  return sendToTenant(
    env,
    tenantId,
    "Action needed: payment failed",
    wrap(
      "Payment failed",
      `<p>Your last payment didn't go through. Paid features keep working for ${PAYMENT_FAILURE_GRACE_DAYS} days after your billing period ends; after that your workspace moves to the Free plan.</p>` +
        "<p>To fix it, open Billing and choose Manage billing to update your payment method.</p>",
      "/dashboard/billing"
    )
  );
}

export async function notifySubscriptionCancelled(env: Env, tenantId: string): Promise<boolean> {
  return sendToTenant(
    env,
    tenantId,
    "Your subscription has been cancelled",
    wrap(
      "Subscription cancelled",
      `<p>Your paid plan has been cancelled, and your workspace is now on Free: your own Search Console and GA4 data, up to ${FREE_DAILY_TOOL_CALLS} tool calls a day.</p>` +
        "<p>Market-data tools stop working. Any wallet balance is kept in case you resubscribe, and anyone on your team goes back to their own workspace until then.</p>",
      "/dashboard/billing"
    )
  );
}

/** threshold is 80 or 100 (percent of the plan's monthly included market data). */
export async function notifyQuotaWarning(env: Env, tenantId: string, threshold: 80 | 100, plan: Plan): Promise<boolean> {
  const subject = threshold === 100 ? "You've used this month's included market data" : "You're at 80% of this month's included market data";
  const upgrade = plan === "pro" ? " Or move to Team for a larger monthly allowance." : "";
  const bodyHtml =
    threshold === 100
      ? `<p>You've used all the keyword, backlink, SERP and AI-visibility data included in your ${PLAN_NAME[plan]} plan this month.</p>` +
        `<p>Those calls keep working while your overage wallet has credit, charged at cost plus ${OVERAGE_MARKUP_PCT}%. With an empty wallet they're blocked until your next billing period. Top up from Billing.${upgrade}</p>`
      : `<p>You've used 80% of the market data included in your ${PLAN_NAME[plan]} plan this month.</p>` +
        `<p>Past 100%, calls draw from your overage wallet at cost plus ${OVERAGE_MARKUP_PCT}%, so top it up now if it's low.${upgrade}</p>`;
  return sendToTenant(env, tenantId, subject, wrap(subject, bodyHtml, "/dashboard/billing"));
}

/** Sent whenever a Dodo wallet top-up payment is credited (src/billing/webhook-handlers.ts's handlePaymentSucceeded). */
export async function notifyWalletTopup(env: Env, tenantId: string, amountUsd: number): Promise<boolean> {
  return sendToTenant(
    env,
    tenantId,
    "Wallet credited",
    wrap("Wallet credited", `<p>$${amountUsd.toFixed(2)} was added to your overage wallet. It's used automatically for market-data calls once your plan's included amount runs out for the month.</p>`, "/dashboard/billing")
  );
}

/** Sent at most once per LOW_WALLET_COOLDOWN_HOURS while the wallet balance stays under the warning threshold (src/clients/dataforseo/client.ts). */
export async function notifyLowWalletBalance(env: Env, tenantId: string, remainingUsd: number): Promise<boolean> {
  return sendToTenant(
    env,
    tenantId,
    "Your overage wallet is running low",
    wrap(
      "Wallet running low",
      `<p>Your overage wallet has about $${remainingUsd.toFixed(2)} left. Once it reaches $0, market-data calls beyond your plan's included amount are blocked until you top up from Billing.</p>`,
      "/dashboard/billing"
    )
  );
}

// Not applicable: a pSEO lead-capture confirmation. Verified against
// src/marketing/pages.ts/routes.ts (M16's own output): no marketing page
// collects an email address (no <form> exists), so there's nothing to hook.

/**
 * Sent to an invitee's email address, not to a tenant: they may not have
 * an account yet. The accept link only works when opened by a signed-in
 * user with this exact email (see src/db/team.ts's checkInvite), so a
 * forwarded email can't hand out a seat.
 */
export async function notifyTeamInvite(env: Env, toEmail: string, inviterEmail: string | null, acceptUrl: string): Promise<boolean> {
  const who = inviterEmail ? escapeHtml(inviterEmail) : "A teammate";
  return sendEmail(env, {
    to: toEmail,
    subject: `You're invited to a ${DISPLAY_NAME} team`,
    html: wrap(
      "You've been invited to a team",
      `<p>${who} invited you to join their ${DISPLAY_NAME} Team workspace. Sign in (or create an account) with this email address, then accept here:</p>` +
        `<p><a href="${escapeHtml(acceptUrl)}">${escapeHtml(acceptUrl)}</a></p>` +
        `<p>The link expires in ${TEAM_INVITE_TTL_DAYS} days.</p>`,
      null
    )
  });
}
