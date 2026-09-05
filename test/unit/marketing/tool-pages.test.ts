import { describe, expect, it } from "vitest";
import { TOOL_MANIFEST } from "../../../src/mcp/manifest";
import { findToolPage, TOOL_PAGES } from "../../../src/marketing/content/tool-pages";
import { renderToolPage } from "../../../src/marketing/pages/ToolPage";
import { renderToolsIndex } from "../../../src/marketing/pages/ToolsIndexPage";

/** hono/jsx auto-escapes text children; matches its exact escape set (utils/html.js) so an assertion against raw copy still finds it in rendered output. */
function jsxEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

describe("pSEO tool page generation", () => {
  it("produces exactly one page per manifest tool", () => {
    expect(TOOL_PAGES).toHaveLength(TOOL_MANIFEST.length);
    const slugs = new Set(TOOL_PAGES.map((p) => p.slug));
    expect(slugs.size).toBe(TOOL_MANIFEST.length); // all slugs unique
  });

  it("every page has a non-empty title, meta description, and real summary text", () => {
    for (const page of TOOL_PAGES) {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.metaDescription.length).toBeGreaterThan(0);
      expect(page.metaDescription).toContain(page.entry.summary.split(".")[0]);
      expect(page.path).toBe(`/tools/${page.slug}`);
    }
  });

  it("slugs are derived from the real manifest tool name (underscores to hyphens)", () => {
    const inspectDomain = findToolPage("inspect-domain");
    expect(inspectDomain).toBeDefined();
    expect(inspectDomain?.entry.name).toBe("inspect_domain");
  });

  it("findToolPage returns undefined for an unknown slug", () => {
    expect(findToolPage("not-a-real-tool")).toBeUndefined();
  });

  it("rendered tool page body contains the manifest's real summary and fact types, not invented copy", () => {
    for (const entry of TOOL_MANIFEST) {
      const page = findToolPage(entry.name.replace(/_/g, "-"));
      expect(page).toBeDefined();
      const html = renderToolPage(page!, "https://example.com/tools/x", true);
      expect(html).toContain(jsxEscape(entry.summary));
      for (const factType of entry.fact_types) {
        expect(html).toContain(factType);
      }
      // basic on-page SEO: exactly one h1, a title, a meta description, a canonical link
      expect((html.match(/<h1/g) ?? []).length).toBe(1);
      expect(html).toContain("<title>");
      expect(html).toContain('name="description"');
      expect(html).toContain('rel="canonical"');
      // no <img> tags at all, so the "alt text on images" bar is trivially met
      expect(html).not.toContain("<img");
    }
  });

  it("billing note reflects the tool's real billing field (free vs dataforseo)", () => {
    const freeTool = TOOL_MANIFEST.find((t) => t.billing === "free")!;
    const paidTool = TOOL_MANIFEST.find((t) => t.billing === "dataforseo")!;
    const freePage = findToolPage(freeTool.name.replace(/_/g, "-"))!;
    const paidPage = findToolPage(paidTool.name.replace(/_/g, "-"))!;

    const freeHtml = renderToolPage(freePage, "https://example.com/tools/free", true);
    const paidHtml = renderToolPage(paidPage, "https://example.com/tools/paid", true);

    expect(freeHtml).toContain("No DataForSEO account or API key needed");
    expect(paidHtml).toContain("DataForSEO-backed tier");
  });

  it("the tools index page links to every tool page and has exactly one h1", () => {
    const html = renderToolsIndex("https://example.com/tools", true);
    for (const page of TOOL_PAGES) {
      expect(html).toContain(`href="${page.path}"`);
    }
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
  });
});
