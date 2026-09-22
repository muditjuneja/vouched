/**
 * `npm run docs:tools`: regenerates docs/TOOLS.md from the single source
 * of truth (src/mcp/manifest.ts), so the tool reference can't drift out of
 * sync with what's actually registered.
 */
import { writeFileSync } from "node:fs";
import { TOOL_MANIFEST } from "../src/mcp/manifest";

const NONE = "-";

function section(domain: string, billing: string): string {
  const rows = TOOL_MANIFEST.filter((t) => t.domain === domain);
  if (rows.length === 0) return "";

  const lines = [
    `## \`${domain}\` (${billing})`,
    "",
    "| Tool | Summary | Fact types | Source classes | Connection |",
    "|---|---|---|---|---|"
  ];

  for (const tool of rows) {
    // Not just informational: a tool with implemented: false isn't
    // registered on the live MCP server either (see src/mcp/server.ts), so
    // this table would otherwise list something that can't actually be
    // called yet as if it were a normal, working tool.
    const name = tool.implemented ? `\`${tool.name}\`` : `\`${tool.name}\` (not yet exposed)`;
    lines.push(
      `| ${name} | ${tool.summary} | ${tool.fact_types.map((f) => `\`${f}\``).join(", ") || NONE} | ${
        tool.source_classes.map((s) => `\`${s}\``).join(", ") || NONE
      } | ${tool.requires_connection ? `\`${tool.requires_connection}\`` : NONE} |`
    );
  }

  return lines.join("\n") + "\n";
}

const domainsFree = ["core", "audit", "gsc", "analytics"];
const domainsPaid = ["seo", "serp", "backlinks", "ai_visibility"];

const body = [
  "# Tool reference",
  "",
  "Generated from `src/mcp/manifest.ts` by `npm run docs:tools`, edit that file, not this one.",
  "",
  `${TOOL_MANIFEST.length} tools total, ${TOOL_MANIFEST.filter((t) => t.implemented).length} implemented.`,
  "",
  "## Free tier, no paid vendor",
  "",
  ...domainsFree.map((d) => section(d, "free")),
  "## DataForSEO-backed tier, bring your own key",
  "",
  ...domainsPaid.map((d) => section(d, "dataforseo"))
].join("\n");

writeFileSync(new URL("../docs/TOOLS.md", import.meta.url), body);
console.log("wrote docs/TOOLS.md");
