import { verifyWebhook } from "@clerk/backend/webhooks";
import { onboardUser } from "../email/welcome";
import type { Env } from "../types/env";

/**
 * POST /webhooks/clerk: Clerk's user.created event, the one moment every
 * new account passes through, however the person arrived. Before this, a
 * signup was only noticed once the person opened the dashboard, so someone
 * who signed up inside an MCP client got no welcome email at all.
 *
 * Auth is the Standard Webhooks (Svix) signature, checked against
 * CLERK_WEBHOOK_SIGNING_SECRET by Clerk's own verifyWebhook. Configure it in
 * the Clerk dashboard under Webhooks: endpoint `https://<host>/webhooks/clerk`,
 * event `user.created`; the endpoint's signing secret (`whsec_...`) goes in
 * the Worker secret.
 *
 * Always 2xx once the signature checks out, even when the email fails to
 * send: a retry would hit the same failure, and the /authorize and dashboard
 * paths try the welcome again on their own.
 */
export async function handleClerkWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.CLERK_WEBHOOK_SIGNING_SECRET) return new Response("not found", { status: 404 });

  let event;
  try {
    event = await verifyWebhook(request, { signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET });
  } catch {
    return new Response("invalid signature", { status: 400 });
  }

  if (event.type === "user.created") {
    const createdAt = typeof event.data.created_at === "number" ? new Date(event.data.created_at).toISOString() : undefined;
    await onboardUser(env, event.data.id, { source: "clerk_webhook", signedUpAt: createdAt });
  }
  return new Response("ok", { status: 200 });
}
