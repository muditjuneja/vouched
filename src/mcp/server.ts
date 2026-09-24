import { McpServer } from "@modelcontextprotocol/server";
import { envelope } from "../envelope/builder";
import { discoverAiCitations } from "../domains/ai_visibility/discover-ai-citations";
import { inspectAiVisibility } from "../domains/ai_visibility/inspect-ai-visibility";
import { getWebsiteAnalytics } from "../domains/analytics/get-website-analytics";
import { compareBacklinkGap } from "../domains/backlinks/compare-backlink-gap";
import { inspectBacklinks } from "../domains/backlinks/inspect-backlinks";
import { describeCapabilities } from "../domains/core/describe-capabilities";
import { exportDataset } from "../domains/core/export-dataset";
import { listWebsitesTool } from "../domains/core/list-websites";
import { getSearchPerformance } from "../domains/gsc/get-search-performance";
import { inspectIndexing } from "../domains/gsc/inspect-indexing";
import { listSitemapsTool } from "../domains/gsc/list-sitemaps";
import { compareKeywordCoverage } from "../domains/seo/compare-keyword-coverage";
import { discoverCompetitors } from "../domains/seo/discover-competitors";
import { inspectDomain } from "../domains/seo/inspect-domain";
import { inspectKeyword } from "../domains/seo/inspect-keyword";
import { inspectPage } from "../domains/seo/inspect-page";
import { inspectSearchVisibility } from "../domains/seo/inspect-search-visibility";
import { researchKeywords } from "../domains/seo/research-keywords";
import { inspectSerp } from "../domains/serp/inspect-serp";
import type { ToolModule } from "../domains/types";
import type { Plan } from "../db/subscriptions";
import { ofeEnvelopeSchema } from "../envelope/schema";
import { ConnectionRequiredError, QuotaExceededError, UpgradeRequiredError } from "../lib/errors";
import { DISPLAY_NAME, MCP_SERVER_NAME, SITE_URL } from "../lib/product";
import { hasDataForSEO, type Env } from "../types/env";
import { checkDailyCap } from "./daily-cap";

// Free, no keys needed. Grows as each milestone lands.
// audit_site is intentionally NOT registered here despite being fully
// built (see its `implemented: false` entry in mcp/manifest.ts for why):
// held back until its crawl is reworked to actually fit this Workers
// architecture, so it isn't exposed as a real tool call until then.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FREE_TOOL_MODULES: ToolModule<any>[] = [
  describeCapabilities,
  listWebsitesTool,
  exportDataset,
  getSearchPerformance,
  inspectIndexing,
  listSitemapsTool,
  getWebsiteAnalytics
];

// Backed by DataForSEO, only registered (and only then advertised by
// describe_capabilities) when DATAFORSEO_LOGIN/PASSWORD are configured, so
// the server never lists a tool call it would just fail on. All 12 tools
// here are now built, see README's Status section for per-domain
// field-shape confidence (ai_visibility is the least certain).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DATAFORSEO_TOOL_MODULES: ToolModule<any>[] = [
  researchKeywords,
  inspectPage,
  inspectSerp,
  inspectSearchVisibility,
  inspectKeyword,
  discoverCompetitors,
  inspectDomain,
  compareKeywordCoverage,
  inspectBacklinks,
  compareBacklinkGap,
  discoverAiCitations,
  inspectAiVisibility
];

/**
 * Builds a fresh McpServer for one request, with every implemented tool
 * registered against this request's `env` (D1/R2 bindings + secrets),
 * captured via closure: `createMcpHandler`'s factory has no other way to
 * reach Worker bindings, so this is the mechanism, not a workaround.
 *
 * `tenantId` is null in self-host mode (the default) and the Clerk user id
 * in cloud mode, resolved by the caller (src/index.ts's /mcp route) from
 * the presented API key before this is called. It's threaded into a
 * per-request copy of `env` (see Env.__tenantId's doc comment) rather than
 * changing every ToolModule's handler signature, only a few tools
 * currently need it.
 *
 * `plan` is the tenant's effective plan (cloud mode only, null otherwise),
 * resolved once by the caller and used here for the free-tier daily cap.
 */
/** Tools that only read this server's own data; every other tool queries Google or a market-data provider. */
const CLOSED_WORLD_TOOLS = new Set(["describe_capabilities", "list_websites", "export_dataset"]);

/**
 * MCP tool annotations, which clients use to decide what needs a
 * confirmation and which directories (Anthropic's among them) require.
 * Every tool here only reads: nothing creates, changes or deletes anything,
 * so repeating a call is always safe.
 */
export function toolAnnotations(name: string) {
  return { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: !CLOSED_WORLD_TOOLS.has(name) };
}

/**
 * A failed call, reported the MCP way (isError, with the reason as text) and
 * also as a normal envelope whose `data.error` carries a stable code, so an
 * agent can handle failures and results the same way.
 */
export function toolError(code: string, message: string, extra: Record<string, unknown> = {}) {
  const result = envelope("core", { error: { code, message, ...extra } })
    .setCoverage({ returned: 0, total: 0, as_of: null, scope_note: message })
    .build();
  return {
    isError: true,
    content: [{ type: "text" as const, text: `${code}: ${message}` }],
    structuredContent: result
  };
}

export function buildMcpServer(env: Env, tenantId: string | null = null, plan: Plan | null = null): McpServer {
  // title/websiteUrl/icons: how clients label this server in their UI.
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    title: DISPLAY_NAME,
    version: "0.1.0",
    websiteUrl: SITE_URL,
    icons: [
      { src: `${SITE_URL}/brand/icon-512.png`, mimeType: "image/png", sizes: ["512x512"] },
      { src: `${SITE_URL}/brand/icon.svg`, mimeType: "image/svg+xml", sizes: ["any"] }
    ]
  });
  const requestEnv: Env = { ...env, __tenantId: tenantId };

  const toolModules = hasDataForSEO(env)
    ? [...FREE_TOOL_MODULES, ...DATAFORSEO_TOOL_MODULES]
    : FREE_TOOL_MODULES;

  for (const tool of toolModules) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: ofeEnvelopeSchema,
        annotations: { title: tool.title, ...toolAnnotations(tool.name) }
      },
      async (args: Record<string, unknown>) => {
        const capError = await checkDailyCap(requestEnv, tenantId, plan);
        if (capError) return toolError("daily_limit_exceeded", capError);
        try {
          const result = await tool.handler(args, requestEnv);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
            structuredContent: result
          };
        } catch (error) {
          if (error instanceof ConnectionRequiredError) {
            return toolError("connection_required", error.message, { connection: error.connection });
          }
          if (error instanceof QuotaExceededError) return toolError("quota_exceeded", error.message);
          if (error instanceof UpgradeRequiredError) return toolError("upgrade_required", error.message);
          return toolError("tool_failed", error instanceof Error ? error.message : String(error));
        }
      }
    );
  }

  return server;
}
