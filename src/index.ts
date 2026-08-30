import { createMcpHandler } from "agents/mcp/server";
import { buildMcpServer } from "./mcp/server";
import type { Env } from "./types/env";

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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("mcp-seo-toolkit: ok\n", { status: 200 });
    }

    if (!env.MCP_BEARER_TOKEN) {
      return new Response("server misconfigured: MCP_BEARER_TOKEN is not set", { status: 500 });
    }

    if (!isAuthorized(request, env)) {
      return new Response("unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" }
      });
    }

    // A fresh factory per request, closing over this request's `env` —
    // `McpRequestContext` (what the SDK actually hands the factory) carries
    // no Worker bindings, so this closure is how tool handlers reach D1/R2.
    const handler = createMcpHandler(() => buildMcpServer(env));
    return handler(request, env, ctx);
  }
} satisfies ExportedHandler<Env>;
