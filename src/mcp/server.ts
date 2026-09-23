import { McpServer } from "@modelcontextprotocol/server";
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
import { ConnectionRequiredError, QuotaExceededError } from "../lib/errors";
import { MCP_SERVER_NAME } from "../lib/product";
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
export function buildMcpServer(env: Env, tenantId: string | null = null, plan: Plan | null = null): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: "0.1.0" });
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
        outputSchema: ofeEnvelopeSchema
      },
      async (args: Record<string, unknown>) => {
        const capError = await checkDailyCap(requestEnv, tenantId, plan);
        if (capError) {
          return { isError: true, content: [{ type: "text" as const, text: capError }] };
        }
        try {
          const result = await tool.handler(args, requestEnv);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
            structuredContent: result
          };
        } catch (error) {
          if (error instanceof ConnectionRequiredError) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: `connection_required (${error.connection}): ${error.message}`
                }
              ]
            };
          }
          if (error instanceof QuotaExceededError) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: `quota_exceeded: ${error.message}` }]
            };
          }
          const message = error instanceof Error ? error.message : String(error);
          return { isError: true, content: [{ type: "text" as const, text: message }] };
        }
      }
    );
  }

  return server;
}
