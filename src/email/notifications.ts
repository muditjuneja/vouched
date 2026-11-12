import { getTenantEmail } from "../auth/clerk";
import type { ScopeGroup } from "../db/google-tokens";
import type { Plan } from "../db/subscriptions";
import type { Env } from "../types/env";
import { sendEmail } from "./client";
import { escapeHtml, renderEmail, type EmailContent } from "./layout";
import { DISPLAY_NAME, SITE_URL } from "../lib/product";
import {
  FREE_DAILY_TOOL_CALLS,
  MONTHLY_QUOTA_USD,
  OVERAGE_MARKUP_MULTIPLIER,
  PLAN_PRICES_USD,
  TEAM_INVITE_TTL_DAYS
} from "../billing/quotas";
import { PAYMENT_FAILURE_GRACE_DAYS } from "../db/subscriptions";

/**
 * Every function here resolves the recipient's email itself (via Clerk, see
 * getTenantEmail's doc comment for why) and never throws: a null email, a
 * disabled email config, or a delivery failure all just mean "this
 * notification didn't go out", logged, not a broken caller flow.
 *
 * Copy lives here; the look lives in src/email/layout.ts.
 */
async function sendToTenant(env: Env, tenantId: string, subject: string, content: EmailContent): Promise<boolean> {
  const to = await getTenantEmail(env, tenantId);
  if (!to) {
    console.warn(`[email] no email on file for tenant ${tenantId}, skipping "${subject}"`);
    return false;
  }
  return sendEmail(env, { to, subject, ...renderEmail(content) });
}

const PLAN_NAME: Record<Plan, string> = { free: "Free", pro: "Pro", team: "Team" };
const OVERAGE_MARKUP_PCT = Math.round((OVERAGE_MARKUP_MULTIPLIER - 1) * 100);
const MCP_URL = `${SITE_URL}/mcp`;
const dash = (path = "") => `${SITE_URL}/dashboard${path}`;
const SAMPLE_PROMPT = "Which of my pages lost the most clicks this month, and why?";

function planFacts(plan: Plan): EmailContent["blocks"][number] {
  if (plan === "free") {
    return {
      kind: "facts",
      title: "Your plan · Free",
      rows: [
        { label: "Your Search Console & GA4 data", value: "Included" },
        { label: "Tool calls", value: `${FREE_DAILY_TOOL_CALLS} / day` },
        { label: "Keyword, backlink, SERP & AI-visibility data", value: `Pro · $${PLAN_PRICES_USD.pro}/mo` }
      ]
    };
  }
  return {
    kind: "facts",
    title: `Your plan · ${PLAN_NAME[plan]}`,
    rows: [
      { label: "Your Search Console & GA4 data", value: "Included" },
      { label: "Tool calls", value: "No daily cap" },
      { label: "Keyword, backlink, SERP & AI-visibility data", value: `$${MONTHLY_QUOTA_USD[plan]}/mo included` }
    ]
  };
}

export interface WelcomeOptions {
  /** The MCP client the person just approved, when that's what triggered the welcome. Self-reported by the client, so escaped. */
  clientName?: string | null;
  plan?: Plan;
}

/** The welcome email's content, exported so it can be previewed and tested without sending. */
export function welcomeEmail({ clientName, plan = "free" }: WelcomeOptions = {}): { subject: string; content: EmailContent } {
  const steps = (third: { title: string; html: string }) => ({
    kind: "steps" as const,
    items: [
      { title: "Add your site", html: "Pick the domain you want your agent to work on." },
      {
        title: "Connect Google",
        html: "Search Console and Analytics, read-only. Until this is done the data tools have nothing to read, so your agent can only describe what it <em>could</em> do."
      },
      third
    ]
  });

  if (clientName) {
    const client = escapeHtml(clientName.slice(0, 60));
    return {
      subject: `${clientName.slice(0, 60)} is connected to ${DISPLAY_NAME}. One step left.`,
      content: {
        preheader: `Connect Google and ${clientName.slice(0, 60)} can answer from your own Search Console and Analytics data.`,
        eyebrow: `Connected · ${clientName.slice(0, 60)}`,
        heading: `${client} is in. <em>One step</em> to real data.`,
        blocks: [
          {
            kind: "p",
            html: `${client} can reach ${DISPLAY_NAME} now, but there's nothing for it to read yet. Connect Google and it answers from your own Search Console and Analytics, with every number traced to its source.`
          },
          steps({ title: `Ask ${clientName.slice(0, 60)}`, html: `Head back and try: <strong>“${SAMPLE_PROMPT}”</strong>` }),
          { kind: "cta" },
          planFacts(plan)
        ],
        cta: { label: "Add your site", href: dash("/websites") }
      }
    };
  }

  return {
    subject: `Welcome to ${DISPLAY_NAME}. Let's give your agent real data.`,
    content: {
      preheader: "Three steps: add your site, connect Google, point your AI client at Vouched.",
      eyebrow: "Welcome",
      heading: "You're in. Now give your agent <em>real</em> SEO data.",
      blocks: [
        {
          kind: "p",
          html: `${DISPLAY_NAME} is an MCP server that answers SEO questions with facts it can cite: your own Search Console and Analytics, straight from Google. Your workspace is ready.`
        },
        steps({
          title: "Connect your AI client",
          html: "Claude, Cursor or any MCP client: add the server URL below and sign in. Prefer a key? Create one in the dashboard."
        }),
        { kind: "code", label: "MCP server URL", text: MCP_URL },
        { kind: "cta" },
        planFacts(plan),
        { kind: "note", html: `Once Google is connected, ask your agent: <strong>“${SAMPLE_PROMPT}”</strong>` }
      ],
      cta: { label: "Add your site", href: dash("/websites") }
    }
  };
}

/** Sent once per person, from whichever comes first: Clerk's signup webhook, an MCP client's consent, or the dashboard (see src/email/welcome.ts). */
export async function notifyWelcome(env: Env, userId: string, options: WelcomeOptions = {}): Promise<boolean> {
  const { subject, content } = welcomeEmail(options);
  return sendToTenant(env, userId, subject, content);
}

/** Sent every time an MCP API key is created: issuance and rotation both go through the same call. */
export async function notifyApiKeyIssued(env: Env, tenantId: string, label: string | null): Promise<boolean> {
  return sendToTenant(env, tenantId, "A new API key was created on your account", {
    preheader: "If this wasn't you, revoke it now.",
    eyebrow: "Security",
    heading: "New API key created",
    blocks: [
      { kind: "p", html: "A new MCP API key was just created for your account." },
      ...(label ? [{ kind: "code" as const, label: "Key label", text: label }] : []),
      { kind: "note", html: "If this wasn't you, revoke it right away on the API keys page, then replace your other keys too." }
    ],
    cta: { label: "Review API keys", href: dash("/api-keys") }
  });
}

const SCOPE_LABEL: Record<ScopeGroup, string> = {
  webmaster_console: "Search Console",
  analytics_property: "Google Analytics"
};

/** Sent when a connected Google account's refresh token has been revoked/expired, see checkConnectionState's "reconnect_required". */
export async function notifyReconnectRequired(env: Env, tenantId: string, scope: ScopeGroup): Promise<boolean> {
  const name = SCOPE_LABEL[scope];
  return sendToTenant(env, tenantId, `Reconnect your ${name} account`, {
    preheader: `Your agent can't read ${name} until you reconnect.`,
    eyebrow: "Connection",
    heading: `Your ${name} connection <em>stopped working</em>`,
    blocks: [
      {
        kind: "p",
        html: `Google stopped accepting our access, most likely because it was revoked or expired. Until you reconnect, any tool that reads ${name} returns a connection error.`
      }
    ],
    cta: { label: `Reconnect ${name}`, href: dash("/settings") }
  });
}

export async function notifyPaymentReceipt(env: Env, tenantId: string, plan: Plan): Promise<boolean> {
  return sendToTenant(env, tenantId, "Payment received", {
    preheader: `Your ${PLAN_NAME[plan]} plan is active.`,
    eyebrow: "Billing",
    heading: `Thanks. <em>${PLAN_NAME[plan]}</em> is active.`,
    blocks: [planFacts(plan), { kind: "p", html: "Invoices, payment method and cancellation are all under Billing." }],
    cta: { label: "Open Billing", href: dash("/billing") }
  });
}

export async function notifyPaymentFailed(env: Env, tenantId: string): Promise<boolean> {
  return sendToTenant(env, tenantId, "Action needed: payment failed", {
    preheader: "Update your payment method to keep paid features.",
    eyebrow: "Billing",
    heading: "Your last payment <em>didn't go through</em>",
    blocks: [
      {
        kind: "p",
        html: `Paid features keep working for ${PAYMENT_FAILURE_GRACE_DAYS} days after your billing period ends. After that, your workspace moves to the Free plan.`
      },
      { kind: "note", html: "To fix it, open Billing and choose <strong>Manage billing</strong> to update your payment method." }
    ],
    cta: { label: "Fix payment", href: dash("/billing") }
  });
}

export async function notifySubscriptionCancelled(env: Env, tenantId: string): Promise<boolean> {
  return sendToTenant(env, tenantId, "Your subscription has been cancelled", {
    preheader: "Your workspace is now on the Free plan.",
    eyebrow: "Billing",
    heading: "Your subscription is <em>cancelled</em>",
    blocks: [
      { kind: "p", html: "Your workspace is now on Free. Market-data tools stop working; your own Google data keeps flowing." },
      planFacts("free"),
      {
        kind: "p",
        html: "Any wallet balance is kept in case you resubscribe, and anyone on your team goes back to their own workspace until then."
      }
    ],
    cta: { label: "Open Billing", href: dash("/billing") }
  });
}

/** threshold is 80 or 100 (percent of the plan's monthly included market data). */
export async function notifyQuotaWarning(env: Env, tenantId: string, threshold: 80 | 100, plan: Plan): Promise<boolean> {
  const subject = threshold === 100 ? "You've used this month's included market data" : "You're at 80% of this month's included market data";
  const upgrade = plan === "pro" ? " Or move to Team for a larger monthly allowance." : "";
  const blocks: EmailContent["blocks"] =
    threshold === 100
      ? [
          {
            kind: "p",
            html: `You've used all the keyword, backlink, SERP and AI-visibility data included in your ${PLAN_NAME[plan]} plan this month.`
          },
          {
            kind: "note",
            html: `Those calls keep working while your overage wallet has credit, at cost plus ${OVERAGE_MARKUP_PCT}%. With an empty wallet they're blocked until your next billing period.${upgrade}`
          }
        ]
      : [
          { kind: "p", html: `You've used 80% of the market data included in your ${PLAN_NAME[plan]} plan this month.` },
          {
            kind: "note",
            html: `Past 100%, calls draw from your overage wallet at cost plus ${OVERAGE_MARKUP_PCT}%, so top it up now if it's low.${upgrade}`
          }
        ];
  return sendToTenant(env, tenantId, subject, {
    preheader: threshold === 100 ? "Top up your wallet to keep market-data calls running." : "A heads-up before you reach your monthly allowance.",
    eyebrow: `Usage · ${threshold}%`,
    heading: threshold === 100 ? "This month's market data is <em>used up</em>" : "You're at <em>80%</em> of this month's market data",
    blocks,
    cta: { label: "Top up wallet", href: dash("/billing") }
  });
}

/** Sent whenever a Dodo wallet top-up payment is credited (src/billing/webhook-handlers.ts's handlePaymentSucceeded). */
export async function notifyWalletTopup(env: Env, tenantId: string, amountUsd: number): Promise<boolean> {
  return sendToTenant(env, tenantId, "Wallet credited", {
    preheader: `$${amountUsd.toFixed(2)} added to your overage wallet.`,
    eyebrow: "Billing",
    heading: `<em>$${amountUsd.toFixed(2)}</em> added to your wallet`,
    blocks: [
      {
        kind: "p",
        html: "It's used automatically for market-data calls once your plan's included amount runs out for the month."
      }
    ],
    cta: { label: "Open Billing", href: dash("/billing") }
  });
}

/** Sent at most once per LOW_WALLET_COOLDOWN_HOURS while the wallet balance stays under the warning threshold (src/clients/dataforseo/client.ts). */
export async function notifyLowWalletBalance(env: Env, tenantId: string, remainingUsd: number): Promise<boolean> {
  return sendToTenant(env, tenantId, "Your overage wallet is running low", {
    preheader: `About $${remainingUsd.toFixed(2)} left.`,
    eyebrow: "Billing",
    heading: `Your wallet is down to <em>$${remainingUsd.toFixed(2)}</em>`,
    blocks: [
      {
        kind: "p",
        html: "Once it reaches $0, market-data calls beyond your plan's included amount are blocked until you top up."
      }
    ],
    cta: { label: "Top up wallet", href: dash("/billing") }
  });
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
    ...renderEmail({
      preheader: `${inviterEmail ?? "A teammate"} invited you to their ${DISPLAY_NAME} Team workspace.`,
      eyebrow: "Team invite",
      heading: "You've been invited to <em>a team</em>",
      blocks: [
        {
          kind: "p",
          html: `<strong>${who}</strong> invited you to join their ${DISPLAY_NAME} Team workspace. Sign in, or create an account, with this email address, then accept.`
        },
        { kind: "cta" },
        { kind: "code", label: "Or open this link", text: acceptUrl },
        { kind: "note", html: `The link expires in ${TEAM_INVITE_TTL_DAYS} days and only works for this email address.` }
      ],
      cta: { label: "Accept invite", href: acceptUrl },
      reason: `You're receiving this because someone invited this address to a ${DISPLAY_NAME} team.`
    })
  });
}
