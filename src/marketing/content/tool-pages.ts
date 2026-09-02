import { TOOL_MANIFEST, type ToolManifestEntry } from "../../mcp/manifest";

/**
 * Generates one pSEO landing page per real MCP tool, straight from
 * `TOOL_MANIFEST` (the same source `describe_capabilities` reads) — no
 * hardcoded per-tool copy to drift out of sync with what the product
 * actually does. Adding a 19th tool to the manifest gets it a page here
 * for free; renaming one only requires the manifest to change, not this
 * file too.
 */
export interface ToolPageContent {
  slug: string;
  path: string;
  /** Human-readable name, e.g. "Inspect Domain" for `inspect_domain`. */
  title: string;
  metaDescription: string;
  entry: ToolManifestEntry;
}

export const DOMAIN_LABELS: Record<string, string> = {
  core: "Core",
  seo: "SEO",
  serp: "SERP",
  audit: "Technical Audit",
  backlinks: "Backlinks",
  ai_visibility: "AI Visibility",
  gsc: "Search Console",
  analytics: "Analytics"
};

function slugify(toolName: string): string {
  return toolName.replace(/_/g, "-");
}

function humanize(toolName: string): string {
  return toolName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function buildMetaDescription(title: string, entry: ToolManifestEntry): string {
  const scope =
    entry.billing === "free"
      ? "Free, no DataForSEO key needed."
      : "Self-host with your own DataForSEO key (zero markup), or use it bundled on the hosted plans.";
  return truncate(`${title}: ${entry.summary} ${scope}`, 300);
}

export const TOOL_PAGES: ToolPageContent[] = TOOL_MANIFEST.map((entry) => {
  const title = humanize(entry.name);
  const slug = slugify(entry.name);
  return {
    slug,
    path: `/tools/${slug}`,
    title,
    metaDescription: buildMetaDescription(title, entry),
    entry
  };
});

export function findToolPage(slug: string): ToolPageContent | undefined {
  return TOOL_PAGES.find((page) => page.slug === slug);
}
