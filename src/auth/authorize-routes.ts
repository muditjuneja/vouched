import { AuthorizationError, CimdFetchError } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { renderAuthorize, renderAuthorizeError } from "../dashboard/pages/AuthorizePage";
import { signInTarget } from "../dashboard/pages/SignInRequiredPage";
import { resolveTenant } from "../db/team";
import { ConfigError } from "../lib/errors";
import { isCloudMode, type Env } from "../types/env";
import { authenticateDashboardRequest, getTenantEmail } from "./clerk";
import { AUTHORIZE_PATH, MCP_SCOPE, type McpCaller } from "./mcp-oauth";

/**
 * The MCP OAuth authorization endpoint: sign the user in with Clerk (same
 * session and handshake as the dashboard), show the consent page, and on
 * Allow issue the grant for their Clerk user id. See src/auth/mcp-oauth.ts
 * for the rest of the protocol, which the provider handles.
 */
export const authorizeRoutes = new Hono<{ Bindings: Env }>();

function html(body: string, status: number, headers: Headers = new Headers()): Response {
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, { status, headers });
}

authorizeRoutes.on(["GET", "POST"], AUTHORIZE_PATH, async (c) => {
  const env = c.env;
  const oauth = env.OAUTH_PROVIDER;
  if (!isCloudMode(env) || !oauth) return c.text("not found", 404);

  let auth;
  try {
    auth = await authenticateDashboardRequest(c.req.raw, env);
  } catch (error) {
    if (error instanceof ConfigError) return c.text(error.message, 500);
    throw error;
  }
  if (auth.handshakeRedirect) return auth.handshakeRedirect;
  if (!auth.session) {
    // Straight to sign-in, then back to this exact URL (the OAuth request
    // lives in its query string), rather than a page with a button.
    const target = signInTarget(c.req.url, env.CLERK_SIGN_IN_URL ?? null, auth.devBrowserToken ?? null);
    if (!target) return c.text("No sign-in page is configured on this deployment (CLERK_SIGN_IN_URL).", 500);
    const res = new Response(null, { status: 302, headers: { Location: target } });
    for (const cookie of auth.refreshedSetCookies) res.headers.append("Set-Cookie", cookie);
    return res;
  }
  const userId = auth.session.userId;

  try {
    if (c.req.method === "GET") {
      const request = await oauth.parseAuthRequest(c.req.raw);
      const client = await oauth.lookupClient(request.clientId);
      if (!client) return html(renderAuthorizeError("This app isn't registered."), 400);
      const consent = await oauth.beginConsent(request);
      const [email, tenant] = await Promise.all([getTenantEmail(env, userId), resolveTenant(env.DB, userId)]);
      const workspaceLabel =
        tenant.role === "member" ? `the team workspace of ${(await getTenantEmail(env, tenant.tenantId)) ?? "your team"}` : "your workspace";
      const page = renderAuthorize({
        clientName: client.clientName ?? client.clientId,
        publisherDomain: client.clientId.startsWith("https://") ? new URL(client.clientId).hostname : null,
        redirectHost: new URL(request.redirectUri).hostname,
        signedInAs: email,
        workspaceLabel,
        handle: consent.handle
      });
      for (const cookie of auth.refreshedSetCookies) consent.headers.append("Set-Cookie", cookie);
      return html(page, 200, consent.headers);
    }

    const form = await c.req.raw.formData();
    const handle = String(form.get("handle") ?? "");
    if (form.get("decision") !== "approve") {
      const denied = await oauth.denyConsent(c.req.raw, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    const approved = await oauth.approveConsent(c.req.raw, handle, { scope: [MCP_SCOPE] });
    const client = await oauth.lookupClient(approved.request.clientId);
    const props: McpCaller = { kind: "oauth", userId };
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId,
      // Shown in Settings → Connected apps.
      metadata: {
        clientName: client?.clientName ?? approved.request.clientId,
        redirectHost: new URL(approved.request.redirectUri).hostname,
        approvedAt: new Date().toISOString()
      },
      scope: [MCP_SCOPE],
      props
    });
    approved.headers.set("Location", redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  } catch (error) {
    // Only redirect back to the app once it and its exact redirect URI are
    // validated (the error then carries redirectUri); anything else is
    // shown here, never redirected.
    if (error instanceof AuthorizationError && error.redirectUri) {
      const redirect = new URL(error.redirectUri);
      redirect.searchParams.set("error", error.code);
      redirect.searchParams.set("error_description", error.description);
      if (error.state) redirect.searchParams.set("state", error.state);
      if (error.issuer) redirect.searchParams.set("iss", error.issuer);
      return Response.redirect(redirect.href, 302);
    }
    if (error instanceof AuthorizationError) return html(renderAuthorizeError(error.description), 400);
    if (error instanceof CimdFetchError) return html(renderAuthorizeError("This app's details couldn't be verified."), 400);
    throw error;
  }
});
