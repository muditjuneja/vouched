import type { Env } from "../types/env";

/**
 * A minimal operator-notification hook — POSTs a plain `{text}` JSON body
 * to `ADMIN_ALERT_WEBHOOK_URL` (a Slack/Discord incoming webhook both
 * accept that exact shape) when configured, otherwise just logs. Not a
 * replacement for M18's tenant-facing emails — this is for the operator
 * running the deployment to notice billing failures, quota-warning
 * volume, or other operational issues without needing email set up first.
 * Never throws — an alert failing to send must never break the request
 * that triggered it.
 */
export async function sendAdminAlert(env: Env, message: string): Promise<void> {
  console.warn(`[alert] ${message}`);

  if (!env.ADMIN_ALERT_WEBHOOK_URL) return;

  try {
    await fetch(env.ADMIN_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: message, content: message })
    });
  } catch (error) {
    console.error(`[alert] failed to deliver admin alert webhook: ${String(error)}`);
  }
}
