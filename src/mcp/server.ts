import { McpServer } from "@modelcontextprotocol/server";
import { describeCapabilities } from "../domains/core/describe-capabilities";
import { exportDataset } from "../domains/core/export-dataset";
import { listWebsitesTool } from "../domains/core/list-websites";
import type { ToolModule } from "../domains/types";
import { ofeEnvelopeSchema } from "../envelope/schema";
import { ConnectionRequiredError } from "../lib/errors";
import type { Env } from "../types/env";

// M1 scope: core domain only. Later milestones append audit, gsc,
// analytics, then the DataForSEO-backed seo/serp/backlinks/ai_visibility
// tools here as they're built.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOL_MODULES: ToolModule<any>[] = [describeCapabilities, listWebsitesTool, exportDataset];

/**
 * Builds a fresh McpServer for one request, with every implemented tool
 * registered against this request's `env` (D1/R2 bindings + secrets),
 * captured via closure — `createMcpHandler`'s factory has no other way to
 * reach Worker bindings, so this is the mechanism, not a workaround.
 */
export function buildMcpServer(env: Env): McpServer {
  const server = new McpServer({ name: "mcp-seo-toolkit", version: "0.1.0" });

  for (const tool of TOOL_MODULES) {
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
