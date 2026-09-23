/**
 * Comparison-page content. Kept to structural, verifiable facts about
 * *this* project (license, hosting model, pricing mechanism, interface),
 * deliberately not citing competitors' current prices or feature lists,
 * since none of that was fetched live in this build and repeating a
 * remembered number as current fact is exactly the kind of unverified
 * claim this project's docs already warn against (see README/
 * ARCHITECTURE's several "unverified, confirm before trusting" notes).
 * Where a row would need a competitor-specific number, `them` says so
 * plainly instead of guessing.
 */
export interface ComparisonRow {
  label: string;
  us: string;
  them: string;
}

export interface ComparisonPage {
  slug: string;
  competitor: string;
  title: string;
  metaDescription: string;
  intro: string;
  rows: ComparisonRow[];
  caveat: string;
}

const OSS_ROW: ComparisonRow = {
  label: "Source code",
  us: "MIT licensed, fully open source: read every tool's implementation, fork it, self-host it.",
  them: "Closed source."
};

const MCP_ROW: ComparisonRow = {
  label: "Primary interface",
  us: "MCP-native: 18 tools an AI agent (Claude or any MCP client) calls directly, each returning structured, provenance-tagged facts.",
  them: "Web dashboard first; not built around the Model Context Protocol."
};

export const COMPARISON_PAGES: ComparisonPage[] = [
  {
    slug: "ahrefs",
    competitor: "Ahrefs",
    title: "Vouched vs Ahrefs: MCP-native and open source",
    metaDescription:
      "How the open-source, self-hostable Vouched compares to Ahrefs: licensing, hosting, pricing model, and MCP-native access vs a dashboard.",
    intro:
      "Ahrefs is a long-established, dashboard-first SEO suite with its own crawler and " +
      "backlink index. Vouched is a different kind of tool: an open-source MCP " +
      "server that exposes the same category of data (keywords, backlinks, SERPs, " +
      "URL indexing inspection) as callable tools for an AI agent, backed by DataForSEO rather " +
      "than a proprietary index it built itself.",
    rows: [
      OSS_ROW,
      { label: "Self-hostable", us: "Yes, deploy your own copy to Cloudflare Workers.", them: "No, SaaS only." },
      MCP_ROW,
      {
        label: "Underlying data",
        us: "DataForSEO's search/backlink index (third-party, pay-as-you-go), not a proprietary crawler Vouched built itself.",
        them: "Ahrefs' own proprietary web crawler and link index, built and maintained in-house over many years."
      },
      {
        label: "Pricing model",
        us: "Self-host: free forever, bring your own DataForSEO key, zero markup. Cloud: flat monthly plans with bundled DataForSEO usage.",
        them: "Paid seat-based subscription plans; check ahrefs.com for current pricing, we haven't verified a specific number here."
      }
    ],
    caveat:
      "Ahrefs' index scale and feature depth (built over many years) and Vouched's " +
      "DataForSEO-backed coverage are not the same thing, and this page doesn't claim " +
      "equivalence. The honest comparison is structural (open vs. closed, self-hostable " +
      "vs. not, MCP-native vs. dashboard-first), not a feature-count contest."
  },
  {
    slug: "semrush",
    competitor: "Semrush",
    title: "Vouched vs Semrush: open source and MCP-native",
    metaDescription:
      "How the open-source, self-hostable Vouched compares to Semrush: licensing, hosting, pricing model, and MCP-native access vs a dashboard suite.",
    intro:
      "Semrush is a broad, all-in-one marketing suite (SEO, PPC, content, social) delivered " +
      "as a hosted dashboard. Vouched is narrower by design, SEO/marketing data " +
      "only, and ships as an MCP server plus a thin cloud dashboard, not a full " +
      "marketing-suite replacement.",
    rows: [
      OSS_ROW,
      { label: "Self-hostable", us: "Yes, deploy your own copy to Cloudflare Workers.", them: "No, SaaS only." },
      MCP_ROW,
      {
        label: "Scope",
        us: "18 focused SEO/marketing-data tools: keyword research, backlinks, SERP, AI-visibility, URL indexing inspection, GSC/GA4.",
        them: "Broader marketing suite (SEO, advertising, content, social media management) beyond just SEO data."
      },
      {
        label: "Pricing model",
        us: "Self-host: free forever, bring your own DataForSEO key, zero markup. Cloud: flat monthly plans with bundled DataForSEO usage.",
        them: "Tiered paid subscription plans; check semrush.com for current pricing, we haven't verified a specific number here."
      }
    ],
    caveat:
      "Semrush covers far more than SEO data (ads, content, social). This comparison is " +
      "scoped to the SEO/marketing-data overlap, not a claim that Vouched replaces " +
      "the whole suite."
  },
  {
    slug: "open-seo",
    competitor: "OpenRush",
    title: "Vouched vs OpenRush: actually open source",
    metaDescription:
      "Vouched was built as a genuinely open alternative to OpenRush: MIT licensed and self-hostable vs. closed-source and credit-metered.",
    intro:
      "Vouched started as a direct response to OpenRush: despite the name, OpenRush " +
      "is closed-source and sold on a credit-metered plan. Vouched implements the " +
      "same 18-tool manifest (confirmed against OpenRush's own live describe_capabilities " +
      "response) but is MIT licensed, self-hostable, and on self-host bills you " +
      "directly for the DataForSEO usage you consume with zero markup on top.",
    rows: [
      OSS_ROW,
      { label: "Self-hostable", us: "Yes, deploy your own copy to Cloudflare Workers.", them: "No, hosted only." },
      {
        label: "Pricing model",
        us: "Self-host: free forever, bring your own DataForSEO key, zero markup. Cloud: flat monthly plans with bundled usage.",
        them: "Credits at $10 / 1,000 (public pricing fetched 6 Sep 2026). Per-tool credit costs in their docs vs marketing do not always match."
      },
      {
        label: "Search Console (GSC)",
        us: "First-party Google Search Console connection: inspect URL indexing, query 28-day CTR and impressions, and list sitemaps. Confidence 1.0, $0 vendor cost.",
        them: "No direct first-party Google Search Console connection. Third-party scraping/proxy credits only."
      },
      {
        label: "Tool manifest",
        us: "All 18 tools implemented, matching OpenRush's own tool set and naming.",
        them: "The original 18-tool manifest this project's own manifest was checked against."
      }
    ],
    caveat:
      "\"OpenRush\" here refers to the commercial product this project was built as an " +
      "open alternative to (see this project's own README). Credit list price ($10 / 1,000) " +
      "is from OpenRush's public site on 6 Sep 2026; some per-tool credit costs (for example " +
      "discover_competitors) differ between their docs and marketing pages."
  }
];

export function findComparisonPage(slug: string): ComparisonPage | undefined {
  return COMPARISON_PAGES.find((page) => page.slug === slug);
}
