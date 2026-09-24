import { hasEmail, type Env } from "../types/env";

const DEFAULT_API_BASE = "https://api.xmit.sh";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Defaults to XMIT_FROM_EMAIL. */
  from?: string;
}

/**
 * A plain-text copy of an email's HTML, sent alongside it: mail clients that
 * don't render HTML show it, and spam filters score HTML-only mail worse.
 * Our emails are just headings, paragraphs and links, so this stays simple.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, (_m, href: string, label: string) => (label === href ? href : `${label}: ${href}`))
    .replace(/<\/(h1|p)>/g, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * Sends one transactional email via xmit.sh (Transmit): `POST /email/send`,
 * Bearer auth, `{from, to, subject, html, text}`, checked against
 * https://xmit.sh/docs/send-email. `XMIT_API_BASE_URL` overrides the base
 * URL if it ever moves.
 *
 * Never throws: a delivery failure must never break the signup/checkout/
 * key-rotation flow that triggered it (same resilience contract as
 * src/lib/alerts.ts's sendAdminAlert). Returns whether the send succeeded,
 * for callers/tests that want to know.
 */
export async function sendEmail(env: Env, input: SendEmailInput): Promise<boolean> {
  if (!hasEmail(env)) {
    console.warn(`[email] XMIT_API_KEY not set, skipping email to ${input.to}: ${input.subject}`);
    return false;
  }

  const from = input.from ?? env.XMIT_FROM_EMAIL;
  if (!from) {
    console.warn(`[email] no from address (set XMIT_FROM_EMAIL), skipping email to ${input.to}`);
    return false;
  }

  const base = env.XMIT_API_BASE_URL ?? DEFAULT_API_BASE;
  try {
    const res = await fetch(`${base}/email/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.XMIT_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: htmlToText(input.html),
        // An operator copy of every platform email, when configured.
        ...(env.XMIT_BCC_EMAIL && env.XMIT_BCC_EMAIL !== input.to ? { bcc: env.XMIT_BCC_EMAIL } : {})
      })
    });
    if (!res.ok) {
      console.warn(`[email] xmit.sh send failed (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`[email] xmit.sh send threw: ${String(error)}`);
    return false;
  }
}
