import { getOnboardingState, recordFirstClient, recordSignup, type SignupSource } from "../db/signups";
import { getEffectivePlan } from "../db/subscriptions";
import { resolveTenant } from "../db/team";
import { sendAdminAlert } from "../lib/alerts";
import { hasEmail, type Env } from "../types/env";
import { sendOnce } from "./dedup";
import { notifyWelcome } from "./notifications";

export interface OnboardingEvent {
  source: SignupSource;
  /** Clerk's creation time when known (the webhook); defaults to now. */
  signedUpAt?: string;
  /** The MCP client just approved on /authorize. */
  clientName?: string;
}

const SOURCE_LABEL: Record<SignupSource, string> = {
  clerk_webhook: "sign-up",
  mcp_authorize: "an MCP client's sign-in",
  dashboard: "the dashboard"
};

/**
 * MCP clients name themselves at registration, so a name is untrusted: keep
 * it to one short line of plain characters before it reaches an email
 * subject or a Slack/Discord alert (no newlines, no `<!channel>`-style
 * markup). HTML escaping still happens at render time on top of this.
 */
export function cleanClientName(name: string | null | undefined): string | undefined {
  const cleaned = Array.from(name ?? "")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 0x1f && code !== 0x7f && ch !== "<" && ch !== ">";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return cleaned || undefined;
}

/**
 * The single entry point for "this person exists and has done something":
 * records the signup, records their first MCP client, and sends the welcome
 * email exactly once per person. Called from all three places a person can
 * first show up, so the welcome no longer depends on which one comes first:
 *
 * - Clerk's user.created webhook (src/auth/clerk-webhook.ts), the moment
 *   the account exists.
 * - MCP OAuth consent (src/auth/authorize-routes.ts), for someone who signs
 *   up inside Cursor or Claude and may never open the dashboard.
 * - Any dashboard request (src/dashboard/routes.ts), the fallback.
 *
 * Keyed on the person (Clerk user id), not their workspace: a team member's
 * welcome goes to them, not to the team's owner.
 *
 * Never throws: onboarding bookkeeping must not break a sign-in.
 */
export async function onboardUser(env: Env, userId: string, event: OnboardingEvent): Promise<void> {
  try {
    const state = await getOnboardingState(env.DB, userId);
    const clientName = cleanClientName(event.clientName);
    if (state.known && state.welcomed && (state.hasClient || !clientName)) return;

    const now = new Date().toISOString();
    // A known person only needs the row touched again when the webhook
    // brings Clerk's real signup time; otherwise skip the write, which
    // matters when a welcome keeps failing and every dashboard request
    // lands here.
    const isNew = state.known && !event.signedUpAt ? false : await recordSignup(env.DB, userId, event.source, event.signedUpAt ?? now);
    if (isNew) {
      await sendAdminAlert(env, `New signup: ${userId} (first seen via ${SOURCE_LABEL[event.source]}${clientName ? `, ${clientName}` : ""})`);
    }
    if (clientName && !state.hasClient && (await recordFirstClient(env.DB, userId, clientName, now))) {
      // A separate alert from the signup one: most people connect a client
      // after signing up, and which clients people use is worth knowing.
      if (state.known) await sendAdminAlert(env, `${userId} connected their first MCP client: ${clientName}`);
    }

    // No email configured: don't claim the welcome (it would only fail and
    // be released again on every request), so it goes out once email is set up.
    if (!state.welcomed && hasEmail(env)) {
      // The plan of the workspace they're actually in: a team member's welcome shows Team, not their idle personal Free.
      const { tenantId } = await resolveTenant(env.DB, userId);
      const plan = await getEffectivePlan(env.DB, tenantId);
      await sendOnce(env.DB, userId, "welcome", () => notifyWelcome(env, userId, { clientName, plan }));
    }
  } catch (error) {
    console.error(`[onboarding] failed for ${userId}: ${String(error)}`);
  }
}
