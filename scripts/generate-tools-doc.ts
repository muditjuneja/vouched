/**
 * `npm run docs:tools` — regenerates docs/TOOLS.md from the single source
 * of truth (src/mcp/manifest.ts), so the tool reference can't drift out of
 * sync with what's actually registered.
 */
import { writeFileSync } from "node:fs";
import { TOOL_MANIFEST } from "../src/mcp/manifest";

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
    lines.push(
      `| \`${tool.name}\` | ${tool.summary} | ${tool.fact_types.map((f) => `\`${f}\``).join(", ") || "—"} | ${
        tool.source_classes.map((s) => `\`${s}\``).join(", ") || "—"
      } | ${tool.requires_connection ? `\`${tool.requires_connection}\`` : "—"} |`
    );
  }

  return lines.join("\n") + "\n";
}

const domainsFree = ["core", "audit", "gsc", "analytics"];
const domainsPaid = ["seo", "serp", "backlinks", "ai_visibility"];

const body = [
  "# Tool reference",
  "",
  "Generated from `src/mcp/manifest.ts` by `npm run docs:tools` — edit that file, not this one.",
  "",
  `${TOOL_MANIFEST.length} tools total, ${TOOL_MANIFEST.filter((t) => t.implemented).length} implemented.`,
  "",
  "## Free tier — no paid vendor",
  "",
  ...domainsFree.map((d) => section(d, "free")),
  "## DataForSEO-backed tier — bring your own key",
  "",
  ...domainsPaid.map((d) => section(d, "dataforseo"))
].join("\n");

writeFileSync(new URL("../docs/TOOLS.md", import.meta.url), body);
console.log("wrote docs/TOOLS.md");
