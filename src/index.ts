import { createMcpHandler } from "agents/mcp/server";
import { Hono } from "hono";
import { handleOAuthCallback, handleOAuthStart } from "./auth/oauth-routes";
import { verifyApiKey } from "./db/mcp-api-keys";
import { buildMcpServer } from "./mcp/server";
import { isCloudMode, type Env } from "./types/env";

/** Constant-time string compare — avoids leaking the bearer token via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i]! ^ bufB[i]!;
  }
  return diff === 0;
}

function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get("Authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;
  return timingSafeEqual(token, env.MCP_BEARER_TOKEN);
}

// Hono carries the whole cloud-facing surface (dashboard, landing/pSEO
// pages, billing webhooks land here in later milestones) — it's what
// Dodo Payments' own adapter targets and runs natively on Workers. In
// self-host mode (CLOUD_MODE unset) this is just a thin router in front of
// the same handful of routes as before; behavior is unchanged.
const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.text("mcp-seo-toolkit: ok\n"));
app.get("/health", (c) => c.text("mcp-seo-toolkit: ok\n"));

// Browser-hit routes for the Google consent flow — outside the MCP
// endpoint's bearer-header gate by necessity (a browser redirect can't
// carry it), so handleOAuthStart enforces its own setup_token check.
app.get("/oauth/google/start", (c) => handleOAuthStart(c.req.raw, c.env));
app.get("/oauth/google/callback", (c) => handleOAuthCallback(c.req.raw, c.env));

app.all("/mcp", async (c) => {
  let tenantId: string | null = null;

  if (isCloudMode(c.env)) {
    // Cloud mode: a per-tenant issued API key (mcp_api_keys), not the
    // shared bearer token — see src/db/mcp-api-keys.ts's doc comment on
    // why this is a separate mechanism from a Clerk session.
    const header = c.req.raw.headers.get("Authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return c.text("unauthorized", 401, { "WWW-Authenticate": "Bearer" });
    }
    tenantId = await verifyApiKey(c.env.DB, token);
    if (!tenantId) {
      return c.text("unauthorized", 401, { "WWW-Authenticate": "Bearer" });
    }
  } else {
    if (!c.env.MCP_BEARER_TOKEN) {
      return c.text("server misconfigured: MCP_BEARER_TOKEN is not set", 500);
    }
    if (!isAuthorized(c.req.raw, c.env)) {
      return c.text("unauthorized", 401, { "WWW-Authenticate": "Bearer" });
    }
  }

  // A fresh factory per request, closing over this request's `env` —
  // `McpRequestContext` (what the SDK actually hands the factory) carries
  // no Worker bindings, so this closure is how tool handlers reach D1/R2.
  const handler = createMcpHandler(() => buildMcpServer(c.env, tenantId));
  // Hono types executionCtx with its own (older, simpler) local
  // ExecutionContext interface; @cloudflare/workers-types' current one adds
  // fields (tracing/abort) Hono's doesn't declare. Same real object at
  // runtime either way — this cast bridges the two type declarations.
  return handler(c.req.raw, c.env, c.executionCtx as unknown as ExecutionContext);
});

export default app;
