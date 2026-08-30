import { z } from "zod";
import { envelope } from "../../envelope/builder";
import { TOOL_MANIFEST } from "../../mcp/manifest";
import { hasDataForSEO, hasGoogleOAuth, type Env } from "../../types/env";
import type { ToolModule } from "../types";

function isEnabled(entry: (typeof TOOL_MANIFEST)[number], env: Env): boolean {
  if (!entry.implemented) return false;
  if (entry.billing === "dataforseo") return hasDataForSEO(env);
  if (entry.requires_connection) return hasGoogleOAuth(env);
  return true;
}

async function handler(_args: Record<string, never>, env: Env) {
  const tools = TOOL_MANIFEST.map((entry) => ({
    name: entry.name,
    domain: entry.domain,
    summary: entry.summary,
    fact_types: entry.fact_types,
    source_classes: entry.source_classes,
    requires_connection: entry.requires_connection,
    billing: entry.billing,
    implemented: entry.implemented,
    enabled: isEnabled(entry, env)
  }));

  const domains = [...new Set(TOOL_MANIFEST.map((t) => t.domain))].sort();
  const factTypes = [...new Set(TOOL_MANIFEST.flatMap((t) => t.fact_types))].sort();

  return envelope("core", {
    domains,
    tools,
    fact_types: factTypes,
    defaults: { location: "United States", language: "English" }
  })
    .setCoverage({ returned: tools.length, total: tools.length, as_of: null, scope_note: null })
    .build();
}

export const describeCapabilities: ToolModule<z.ZodObject<Record<string, never>>> = {
  name: "describe_capabilities",
  title: "Describe capabilities",
  description: "Enabled domains, tools, fact types, and source classes.",
  inputSchema: z.object({}),
  handler
};
