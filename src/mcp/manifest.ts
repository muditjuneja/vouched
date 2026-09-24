import type { Provenance } from "../envelope/types";

/**
 * Every tool this server offers. `implemented` tracks build progress
 * honestly: `core.describe_capabilities` reports this as-is rather than
 * pretending unbuilt tools already exist.
 */
export interface ToolManifestEntry {
  name: string;
  domain: string;
  summary: string;
  fact_types: string[];
  source_classes: Provenance["source_class"][];
  requires_connection: "webmaster_console" | "analytics_property" | null;
  billing: "free" | "dataforseo";
  implemented: boolean;
}

export const TOOL_MANIFEST: ToolManifestEntry[] = [
  {
    name: "describe_capabilities",
    domain: "core",
    summary: "Enabled domains, tools, fact types, source classes.",
    fact_types: [],
    source_classes: [],
    requires_connection: null,
    billing: "free",
    implemented: true
  },
  {
    name: "export_dataset",
    domain: "core",
    summary: "Fetch a full dataset by mcpseo:// uri.",
    fact_types: [],
    source_classes: [],
    requires_connection: null,
    billing: "free",
    implemented: true
  },
  {
    name: "list_websites",
    domain: "core",
    summary: "List tracked websites and their connection state.",
    fact_types: [],
    source_classes: [],
    requires_connection: null,
    billing: "free",
    implemented: true
  },
  {
    name: "inspect_domain",
    domain: "seo",
    summary: "Compact factual snapshot for one domain.",
    fact_types: ["seo.domain_summary", "seo.keyword_ranking", "seo.top_page", "seo.competitor"],
    source_classes: ["search_index"],
    requires_connection: null,
    billing: "dataforseo",
    implemented: true
  },
  {
    name: "discover_competitors",
    domain: "seo",
    summary: "Organic competitors by overlap or seed keywords.",
    fact_types: ["seo.competitor", "core.data_freshness"],
    source_classes: ["search_index"],
    requires_connection: null,
    billing: "dataforseo",
    implemented: true
  },
  {
    name: "research_keywords",
    domain: "seo",
    summary: "Expand a seed term into a ranked demand list.",
    fact_types: ["seo.keyword_opportunity"],
    source_classes: ["search_index"],
    requires_connection: null,
    billing: "dataforseo",
    implemented: true
  },
  {
    name: "compare_keyword_coverage",
    domain: "seo",
    summary: "Keyword gap vs competitors.",
    fact_types: ["seo.keyword_opportunity"],
    source_classes: ["search_index"],
    requires_connection: null,
    billing: "dataforseo",
    implemented: true
  },
  {
    name: "inspect_search_visibility",
    domain: "seo",
    summary: "Ranking positions across a keyword set.",
    fact_types: ["seo.keyword_ranking", "core.data_freshness"],
    source_classes: ["search_index", "live_serp"],
    requires_connection: null,
    billing: "dataforseo",
    implemented: true
  },
  {
    name: "inspect_keyword",
    domain: "seo",
    summary: "Full detail on a single keyword.",
    fact_types: ["serp.result", "serp.feature"],
    source_classes: ["search_index", "live_serp"],
    requires_connection: null,
    billing: "dataforseo",
    implemented: true
  },
  {
    name: "inspect_page",
    domain: "seo",
    summary: "Keywords + traffic for a single URL.",
    fact_types: ["seo.keyword_ranking", "seo.top_page"],
    source_classes: ["search_index"],
    requires_connection: null,
    billing: "dataforseo",
    implemented: true
  },
  {
    name: "inspect_serp",
    domain: "serp",
    summary: "Live SERP snapshot for one query.",
    fact_types: ["serp.result", "serp.feature"],
    source_classes: ["live_serp"],
    requires_connection: null,
    billing: "dataforseo",
    implemented: true
  },
  {
    name: "audit_site",
    domain: "audit",
    summary: "Fast technical/content health audit.",
    fact_types: ["audit.site_health", "audit.issue_cluster", "audit.crawl_issue"],
    source_classes: ["crawl"],
    requires_connection: null,
    billing: "free",
    // Built and working (src/domains/audit/audit-site.ts), but deliberately
    // held back from `implemented` (and unregistered in mcp/server.ts)
    // until its crawl is reworked for the Workers architecture it actually
    // runs on: today it's a fully sequential, unbounded-concurrency loop
    // with no request budget/timeout handling of its own, fine for a small
    // site but not yet the "best/performant" story we want to ship before
    // exposing it. Flip this back to true once that rework lands.
    implemented: false
  },
  {
    name: "inspect_backlinks",
    domain: "backlinks",
    summary:
      "One domain's link profile, sliced by view (authority / referring domains / anchors / individual backlinks).",
    fact_types: [
      "backlinks.domain_authority",
      "backlinks.referring_domain",
      "backlinks.anchor",
      "backlinks.backlink"
    ],
    source_classes: ["backlink_index"],
    requires_connection: null,
    billing: "dataforseo",
    implemented: true
  },
  {
    name: "compare_backlink_gap",
    domain: "backlinks",
    summary:
      "Backlink gap / link intersect: referring domains that link to N competitors, ranked by true authority, spam-filtered, earned-flagged.",
    fact_types: ["backlinks.link_gap"],
    source_classes: ["backlink_index"],
    requires_connection: null,
    billing: "dataforseo",
    implemented: true
  },
  {
    name: "discover_ai_citations",
    domain: "ai_visibility",
    summary: "Which sources AI cites in your category (Google AI Overview).",
    fact_types: ["ai_visibility.citation_source", "core.data_freshness"],
    source_classes: ["ai_answer"],
    requires_connection: null,
    billing: "dataforseo",
    implemented: true
  },
  {
    name: "inspect_ai_visibility",
    domain: "ai_visibility",
    summary: "How a domain shows up in AI answers, vs named competitors.",
    fact_types: ["ai_visibility.brand_mentions"],
    source_classes: ["ai_answer"],
    requires_connection: null,
    billing: "dataforseo",
    implemented: true
  },
  {
    name: "get_search_performance",
    domain: "gsc",
    summary: "Query/page/date/country/device performance from Search Console, with filters and period-over-period comparison.",
    fact_types: ["gsc.performance_summary", "gsc.query_performance"],
    source_classes: ["webmaster_console"],
    requires_connection: "webmaster_console",
    billing: "free",
    implemented: true
  },
  {
    // Covers Search Console's urlInspection.index:inspect.
    name: "inspect_indexing",
    domain: "gsc",
    summary: "Google's own indexing status for one URL: indexed?, canonical Google chose, mobile usability, rich results, last crawl.",
    fact_types: ["gsc.index_status", "gsc.mobile_usability", "gsc.rich_results"],
    source_classes: ["webmaster_console"],
    requires_connection: "webmaster_console",
    billing: "free",
    implemented: true
  },
  {
    // Covers Search Console's sitemaps.list.
    name: "list_sitemaps",
    domain: "gsc",
    summary: "Submitted sitemaps for a tracked website: last-read status, warnings/errors, submitted counts (Google's indexed count here is deprecated, always 0).",
    fact_types: ["gsc.sitemap_status"],
    source_classes: ["webmaster_console"],
    requires_connection: "webmaster_console",
    billing: "free",
    implemented: true
  },
  {
    name: "get_website_analytics",
    domain: "analytics",
    summary: "Sessions/users/engagement from owned website analytics.",
    fact_types: ["analytics.traffic_summary", "analytics.traffic_by_dimension"],
    source_classes: ["analytics_property"],
    requires_connection: "analytics_property",
    billing: "free",
    implemented: true
  }
];
