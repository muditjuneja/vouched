# Tool reference

Generated from `src/mcp/manifest.ts` by `npm run docs:tools`, edit that file, not this one.

18 tools total, 17 implemented.

## Free tier, no paid vendor

## `core` (free)

| Tool | Summary | Fact types | Source classes | Connection |
|---|---|---|---|---|
| `describe_capabilities` | Enabled domains, tools, fact types, source classes. | - | - | - |
| `export_dataset` | Fetch a full dataset by mcpseo:// uri. | - | - | - |
| `list_websites` | List tracked websites and their connection state. | - | - | - |

## `audit` (free)

| Tool | Summary | Fact types | Source classes | Connection |
|---|---|---|---|---|
| `audit_site` (not yet exposed) | Fast technical/content health audit. | `audit.site_health`, `audit.issue_cluster`, `audit.crawl_issue` | `crawl` | - |

## `gsc` (free)

| Tool | Summary | Fact types | Source classes | Connection |
|---|---|---|---|---|
| `get_search_performance` | Query/page/date/country/device performance from Search Console, with filters and period-over-period comparison. | `gsc.performance_summary`, `gsc.query_performance` | `webmaster_console` | `webmaster_console` |

## `analytics` (free)

| Tool | Summary | Fact types | Source classes | Connection |
|---|---|---|---|---|
| `get_website_analytics` | Sessions/users/engagement from owned website analytics. | `analytics.traffic_summary`, `analytics.traffic_by_dimension` | `analytics_property` | `analytics_property` |

## DataForSEO-backed tier, bring your own key

## `seo` (dataforseo)

| Tool | Summary | Fact types | Source classes | Connection |
|---|---|---|---|---|
| `inspect_domain` | Compact factual snapshot for one domain. | `seo.domain_summary`, `seo.keyword_ranking`, `seo.top_page`, `seo.competitor` | `search_index` | - |
| `discover_competitors` | Organic competitors by overlap or seed keywords. | `seo.competitor`, `core.data_freshness` | `search_index` | - |
| `research_keywords` | Expand a seed term into a ranked demand list. | `seo.keyword_opportunity` | `search_index` | - |
| `compare_keyword_coverage` | Keyword gap vs competitors. | `seo.keyword_opportunity` | `search_index` | - |
| `inspect_search_visibility` | Ranking positions across a keyword set. | `seo.keyword_ranking`, `core.data_freshness` | `search_index`, `live_serp` | - |
| `inspect_keyword` | Full detail on a single keyword. | `serp.result`, `serp.feature` | `search_index`, `live_serp` | - |
| `inspect_page` | Keywords + traffic for a single URL. | `seo.keyword_ranking`, `seo.top_page` | `search_index` | - |

## `serp` (dataforseo)

| Tool | Summary | Fact types | Source classes | Connection |
|---|---|---|---|---|
| `inspect_serp` | Live SERP snapshot for one query. | `serp.result`, `serp.feature` | `live_serp` | - |

## `backlinks` (dataforseo)

| Tool | Summary | Fact types | Source classes | Connection |
|---|---|---|---|---|
| `inspect_backlinks` | One domain's link profile, sliced by view (authority / referring domains / anchors / individual backlinks). | `backlinks.domain_authority`, `backlinks.referring_domain`, `backlinks.anchor`, `backlinks.backlink` | `backlink_index` | - |
| `compare_backlink_gap` | Backlink gap / link intersect: referring domains that link to N competitors, ranked by true authority, spam-filtered, earned-flagged. | `backlinks.link_gap` | `backlink_index` | - |

## `ai_visibility` (dataforseo)

| Tool | Summary | Fact types | Source classes | Connection |
|---|---|---|---|---|
| `discover_ai_citations` | Which sources AI cites in your category (Google AI Overview). | `ai_visibility.citation_source`, `core.data_freshness` | `ai_answer` | - |
| `inspect_ai_visibility` | How a domain shows up in AI answers, vs named competitors. | `ai_visibility.brand_mentions` | `ai_answer` | - |
