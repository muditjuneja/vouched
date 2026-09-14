import { getTenantEmail } from "../auth/clerk";
import type { ScopeGroup } from "../db/google-tokens";
import type { Plan } from "../db/subscriptions";
import type { Env } from "../types/env";
import { sendEmail } from "./client";
import { DISPLAY_NAME } from "../lib/product";

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

function wrap(title: string, bodyHtml: string): string {
  return `<h1>${title}</h1>${bodyHtml}<p>${DISPLAY_NAME}</p>`;
}

/** Sent on a tenant's first dashboard visit, see the dashboard route's markNotifiedOnce("welcome") gate. */
export async function notifyWelcome(env: Env, tenantId: string): Promise<boolean> {
  return sendToTenant(
    env,
    tenantId,
    `Welcome to ${DISPLAY_NAME}`,
    wrap(
      "Welcome aboard",
      "<p>Your account is ready. Connect a website's Search Console/Analytics from the dashboard, or start calling the SEO tools straight from your MCP client with the API key you create there.</p>"
    )
  );
}

/** Sent every time an MCP API key is created: issuance and rotation both go through the same call. */
export async function notifyApiKeyIssued(env: Env, tenantId: string, label: string | null): Promise<boolean> {
  const labelText = label ? ` ("${label}")` : "";
  return sendToTenant(
    env,
    tenantId,
    "A new API key was created on your account",
    wrap(
      "New API key created",
      `<p>A new MCP API key${labelText} was just created for your account. If this wasn't you, revoke it immediately from the dashboard and rotate any others.</p>`
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
      `<p>Your ${SCOPE_LABEL[scope]} connection has stopped working, likely because access was revoked or expired. Reconnect it from the dashboard to keep that data flowing.</p>`
    )
  );
}

export async function notifyPaymentReceipt(env: Env, tenantId: string, plan: Plan): Promise<boolean> {
  return sendToTenant(
    env,
    tenantId,
    "Payment received",
    wrap("Payment received", `<p>Thanks, your ${plan} plan is active. Manage billing anytime from the dashboard.</p>`)
  );
}

export async function notifyPaymentFailed(env: Env, tenantId: string): Promise<boolean> {
  return sendToTenant(
    env,
    tenantId,
    "Action needed: payment failed",
    wrap(
      "Payment failed",
      "<p>Your last payment didn't go through. Update your payment method from the dashboard to avoid losing access to paid features.</p>"
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
      "<p>Your paid plan has been cancelled. You're still welcome to use the free tier, or self-host anytime, see the README.</p>"
    )
  );
}

/** threshold is 80 or 100 (percent of the plan's monthly quota). */
export async function notifyQuotaWarning(env: Env, tenantId: string, threshold: 80 | 100): Promise<boolean> {
  const subject = threshold === 100 ? "You've used 100% of your monthly quota" : "You're at 80% of your monthly quota";
  const bodyHtml =
    threshold === 100
      ? "<p>You've used your full monthly DataForSEO quota. Further seo/serp/backlinks/ai_visibility calls will be blocked until your next billing period, or you can upgrade from the dashboard.</p>"
      : "<p>You've used 80% of this month's DataForSEO quota. Consider upgrading from the dashboard if you expect to need more before your next billing period.</p>";
  return sendToTenant(env, tenantId, subject, wrap(subject, bodyHtml));
}

/** Sent whenever a Dodo wallet top-up payment is credited (src/billing/webhook-handlers.ts's handlePaymentSucceeded). */
export async function notifyWalletTopup(env: Env, tenantId: string, amountUsd: number): Promise<boolean> {
  return sendToTenant(
    env,
    tenantId,
    "Wallet credited",
    wrap("Wallet credited", `<p>$${amountUsd.toFixed(2)} was added to your prepaid overage wallet. It's used automatically for DataForSEO-backed calls once your plan's bundled quota runs out for the month.</p>`)
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
      `<p>Your prepaid overage wallet has about $${remainingUsd.toFixed(2)} left. Once it hits $0, DataForSEO-backed calls beyond your plan's bundled quota will be blocked until you add more credit from the dashboard.</p>`
    )
  );
}

// Not built: a team-invite email. No multi-seat/invite mechanism exists
// anywhere in this codebase yet: Team is currently just a pricing tier
// name, single Clerk user per tenant like every other plan. Add a sender
// here once real multi-seat support exists, rather than inventing invite
// infrastructure just to justify this hook point.

// Not applicable: a pSEO lead-capture confirmation. Verified against
// src/marketing/pages.ts/routes.ts (M16's own output): no marketing page
// collects an email address (no <form> exists), so there's nothing to hook.
