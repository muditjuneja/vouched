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
 * Sends one transactional email via xmit.sh (Transmit).
 *
 * NOTE: xmit.sh's own docs site (xmit.sh/docs) was directly egress-blocked
 * from this sandbox — the endpoint path and body shape below (`POST
 * /email/send`, Bearer auth, `{from, to, subject, html}`) were assembled
 * from indirect web-search snippets of xmit.sh's own marketing/docs pages,
 * not a fetched doc or a live call. Same caveat treatment as DataForSEO's
 * `ai_visibility` endpoints elsewhere in this build: confirm against a real
 * xmit.sh API key before trusting this, and expect to revise the endpoint
 * path or body shape. `XMIT_API_BASE_URL` exists as a safety valve in case
 * the base URL itself needs correcting without a code change.
 *
 * Never throws — a delivery failure must never break the signup/checkout/
 * key-rotation flow that triggered it (same resilience contract as
 * src/lib/alerts.ts's sendAdminAlert). Returns whether the send succeeded,
 * for callers/tests that want to know.
 */
export async function sendEmail(env: Env, input: SendEmailInput): Promise<boolean> {
  if (!hasEmail(env)) {
    console.warn(`[email] XMIT_API_KEY not set — skipping email to ${input.to}: ${input.subject}`);
    return false;
  }

  const from = input.from ?? env.XMIT_FROM_EMAIL;
  if (!from) {
    console.warn(`[email] no from address (set XMIT_FROM_EMAIL) — skipping email to ${input.to}`);
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
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html })
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
