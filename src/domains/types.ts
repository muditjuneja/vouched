import type { z } from "zod";
import type { Envelope } from "../envelope/types";
import type { Env } from "../types/env";

/**
 * The shape every domain tool file exports. `mcp/server.ts` is the only
 * place that turns these into `server.registerTool()` calls — handlers
 * never touch the MCP SDK directly, they just build and return an envelope.
 */
export interface ToolModule<Args extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  title: string;
  description: string;
  inputSchema: Args;
  handler: (args: z.infer<Args>, env: Env) => Promise<Envelope<Record<string, unknown>>>;
}
