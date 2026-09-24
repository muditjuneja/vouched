import { OAuthProvider, type ResolveExternalTokenInput, type ResolveExternalTokenResult } from "@cloudflare/workers-oauth-provider";
import { verifyApiKey } from "../db/mcp-api-keys";
import { DISPLAY_NAME, KEY_PREFIX } from "../lib/product";
import type { Env } from "../types/env";

/**
 * Standard MCP authorization for cloud mode (the MCP spec's OAuth 2.1
 * profile), so a client like Claude can connect with a "Sign in" button
 * instead of a pasted header. `@cloudflare/workers-oauth-provider` does the
 * protocol: the 401 challenge, RFC 9728 resource metadata, RFC 8414 server
 * metadata, client registration (DCR and Client ID Metadata Documents),
 * PKCE, the token endpoint, and hashed token storage in OAUTH_KV. We supply
 * the parts that are ours: who the user is (Clerk, via /authorize in
 * src/auth/authorize-routes.ts) and what a token lets them do (the /mcp
 * route in src/index.ts).
 *
 * Self-host mode never goes through this: it keeps its single shared bearer
 * token (see src/index.ts).
 */

/** The one scope: use this workspace's tools. Billing and team changes stay in the dashboard. */
export const MCP_SCOPE = "mcp";

export const AUTHORIZE_PATH = "/authorize";

/**
 * Who is calling /mcp, as attached to the request by the provider
 * (`ctx.props`). An OAuth token carries the Clerk user, whose workspace is
 * resolved per request so team changes apply straight away; an API key
 * carries the workspace it was created in.
 */
export type McpCaller = { kind: "oauth"; userId: string } | { kind: "api_key"; tenantId: string; createdBy: string };

/** The canonical resource URL clients are issued tokens for: this origin's /mcp. */
export function mcpResource(origin: string): string {
  return `${origin}/mcp`;
}

/**
 * API keys (`vsm_...`) keep working alongside OAuth, for Claude Code,
 * Cursor, scripts and CI. The provider calls this for any bearer token it
 * didn't issue itself; returning null gets the caller the standard 401
 * challenge, which is what prompts an MCP client to offer sign-in.
 */
export async function resolveApiKey({ token, request, env }: ResolveExternalTokenInput<Env>): Promise<ResolveExternalTokenResult | null> {
  if (!token.startsWith(KEY_PREFIX)) return null;
  const key = await verifyApiKey(env.DB, token);
  if (!key) return null;
  const caller: McpCaller = { kind: "api_key", tenantId: key.tenantId, createdBy: key.createdBy };
  return { props: caller, audience: mcpResource(new URL(request.url).origin) };
}

type FetchHandler = { fetch: (request: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response> };

/**
 * One provider per origin: the resource URL and issuer are absolute, and
 * the same Worker answers on vouchedhq.com, its workers.dev name, and
 * localhost in development. Built once per origin per isolate.
 */
const providers = new Map<string, OAuthProvider<Env>>();

export function oauthProviderFor(origin: string, app: FetchHandler): OAuthProvider<Env> {
  let provider = providers.get(origin);
  if (!provider) {
    provider = new OAuthProvider<Env>({
      apiRoute: "/mcp",
      apiHandler: app,
      defaultHandler: app,
      authorizeEndpoint: AUTHORIZE_PATH,
      tokenEndpoint: "/oauth/token",
      clientRegistrationEndpoint: "/oauth/register",
      scopesSupported: [MCP_SCOPE],
      resourceMetadata: {
        resource: mcpResource(origin),
        authorization_servers: [origin],
        scopes_supported: [MCP_SCOPE],
        resource_name: DISPLAY_NAME
      },
      // Client ID Metadata Documents (how Claude and other hosted clients
      // identify themselves) also need the global_fetch_strictly_public
      // compatibility flag in wrangler.jsonc.
      clientIdMetadataDocumentEnabled: true,
      // A connection lasts while it's used: each refresh extends it by 30
      // days, and one left idle for 30 days has to sign in again.
      refreshTokenIdleTTL: 30 * 24 * 60 * 60,
      resolveExternalToken: resolveApiKey
    });
    providers.set(origin, provider);
  }
  return provider;
}
