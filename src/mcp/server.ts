import { McpServer } from "@modelcontextprotocol/server";
import { getWebsiteAnalytics } from "../domains/analytics/get-website-analytics";
import { auditSite } from "../domains/audit/audit-site";
import { describeCapabilities } from "../domains/core/describe-capabilities";
import { exportDataset } from "../domains/core/export-dataset";
import { listWebsitesTool } from "../domains/core/list-websites";
import { getSearchPerformance } from "../domains/gsc/get-search-performance";
import { compareKeywordCoverage } from "../domains/seo/compare-keyword-coverage";
import { discoverCompetitors } from "../domains/seo/discover-competitors";
import { inspectDomain } from "../domains/seo/inspect-domain";
import { inspectKeyword } from "../domains/seo/inspect-keyword";
import { inspectPage } from "../domains/seo/inspect-page";
import { inspectSearchVisibility } from "../domains/seo/inspect-search-visibility";
import { researchKeywords } from "../domains/seo/research-keywords";
import { inspectSerp } from "../domains/serp/inspect-serp";
import type { ToolModule } from "../domains/types";
import { ofeEnvelopeSchema } from "../envelope/schema";
import { ConnectionRequiredError } from "../lib/errors";
import { hasDataForSEO, type Env } from "../types/env";

// Free — no keys needed. Grows as each milestone lands.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FREE_TOOL_MODULES: ToolModule<any>[] = [
  describeCapabilities,
  listWebsitesTool,
  exportDataset,
  auditSite,
  getSearchPerformance,
  getWebsiteAnalytics
];

// Backed by DataForSEO — only registered (and only then advertised by
// describe_capabilities) when DATAFORSEO_LOGIN/PASSWORD are configured, so
// the server never lists a tool call it would just fail on. backlinks/
// ai_visibility domains join this list in M7/M8.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DATAFORSEO_TOOL_MODULES: ToolModule<any>[] = [
  researchKeywords,
  inspectPage,
  inspectSerp,
  inspectSearchVisibility,
  inspectKeyword,
  discoverCompetitors,
  inspectDomain,
  compareKeywordCoverage
];

/**
 * Builds a fresh McpServer for one request, with every implemented tool
 * registered against this request's `env` (D1/R2 bindings + secrets),
 * captured via closure — `createMcpHandler`'s factory has no other way to
 * reach Worker bindings, so this is the mechanism, not a workaround.
 */
export function buildMcpServer(env: Env): McpServer {
  const server = new McpServer({ name: "mcp-seo-toolkit", version: "0.1.0" });

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
        try {
          const result = await tool.handler(args, env);
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
                  text: `connection_required: ${error.connection} — ${error.message}`
                }
              ]
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
