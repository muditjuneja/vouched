---
name: seo-analysis
description: Answer SEO questions from real data with the Vouched MCP tools. Use when the user asks why search traffic or clicks changed, which keywords or pages to target, how they compare with competitors, whether a page is indexed, who links to them, or how they show up in AI answers. Covers which tools to chain, in what order, and how to cite the results.
license: MIT
compatibility: Needs the Vouched MCP server (https://vouchedhq.com/mcp, or a self-hosted copy) connected and signed in.
---

# SEO analysis with Vouched

Vouched returns SEO data as facts with a source, a confidence and a date. Your
job is to pick the right tools, chain them, and answer from those facts rather
than from general SEO knowledge.

## Start every session the same way

1. Call `describe_capabilities` once. It says which tools are enabled on this
   server and what each one costs. Don't call a tool it doesn't list.
2. If the question is about the user's own site, call `list_websites`. The
   `domain` argument of the Search Console and Analytics tools must be one of
   the `primary_domain` values it returns, and it shows which Google
   connections each site has.
3. Work out today's date before choosing date ranges. Search Console data
   lags by about two days; pass `dataState: "all"` if the user needs the
   last day or two.

## Two kinds of data

| Kind | Tools | Cost | Trust |
|---|---|---|---|
| **The user's own data** | `get_search_performance`, `inspect_indexing`, `list_sitemaps`, `get_website_analytics` | Free | Google's own numbers for their site |
| **Market data** | `inspect_domain`, `discover_competitors`, `research_keywords`, `inspect_keyword`, `inspect_serp`, `inspect_search_visibility`, `inspect_page`, `compare_keyword_coverage`, `inspect_backlinks`, `compare_backlink_gap`, `discover_ai_citations`, `inspect_ai_visibility` | Paid per call | Index estimates for any domain; `inspect_serp` is a live Google snapshot |

Prefer the user's own data for their own site. Use market data for competitors,
for keywords they don't rank for yet, and when no Google connection exists.
Market calls cost money, so don't fire them speculatively: run one, read it,
then decide on the next.

## Playbooks

### "Why did our traffic drop?"

1. `get_search_performance` for the recent period with
   `compareToPreviousPeriod: true` and no dimensions, to confirm the size of
   the change in clicks, impressions, CTR and position.
2. Same call with `dimensions: ["page"]`, then `["query"]`, to find where the
   loss is concentrated.
3. Diagnose from the pattern:
   - Impressions down, position steady: demand fell (seasonality or fewer
     searches). Check with `dimensions: ["date"]`.
   - Position down: rankings slipped. Run `inspect_serp` on the top lost
     queries to see who took the spot and whether an AI Overview appeared.
   - Impressions steady, CTR down: the results page changed (new features,
     AI Overview, a competitor with better snippets). `inspect_serp` again.
   - One page lost everything: `inspect_indexing` on that URL.
   - Many pages at once: `list_sitemaps` for errors, then `inspect_indexing`
     on a sample.
4. If Analytics is linked, `get_website_analytics` with
   `dimension: "sessionSource"` shows whether the drop is organic only.

### "What keywords should we go after?"

1. `discover_competitors` for the user's domain (or ask them for 2–3
   competitors).
2. `compare_keyword_coverage` with the user's domain and up to 5 competitors.
3. `research_keywords` from the most promising themes, then `inspect_keyword`
   on the finalists.
4. If the site has Search Console, cross-check with `get_search_performance`
   (`dimensions: ["query"]`): queries with high impressions and a position of
   8–20 are usually the fastest wins.

### "How do we compare with <competitor>?"

`inspect_domain` on both, then `compare_keyword_coverage` and
`compare_backlink_gap`. Report the differences, not two separate profiles.

### "Why isn't this page ranking?"

`inspect_indexing` (is it indexed, which canonical Google chose), then
`inspect_page` (what it ranks for), then `inspect_serp` for the target keyword
to see what does rank.

### Links

`inspect_backlinks` takes one `view` per call: start with `authority`, then
`referring_domains`. `compare_backlink_gap` lists sites linking to competitors
but not to the user, which is the usual outreach list.

### AI answers

`discover_ai_citations` shows which sites AI answers cite for a topic.
`inspect_ai_visibility` shows how often a domain is mentioned compared with up
to 5 competitors. Both take `platform: "google"` (AI Overviews, the default)
or `"chat_gpt"`.

## Reading and citing results

Every response has the same envelope (`schema_version: "ofe/1.0"`):

- Take numbers from `facts`, and check each fact's `provenance`:
  `source_class` (`webmaster_console`, `analytics_property`, `search_index`,
  `live_serp`, `backlink_index`, `ai_answer`), `confidence` and `observed_at`.
- When you state a number, say where it came from: "Search Console: 1,240
  clicks, down 18%" is different from "estimated organic traffic: ~3,000".
  Never add or compare Search Console numbers with index estimates as if they
  were the same measurement.
- Read `coverage` before calling something complete. If `returned` is less
  than `total`, say so. When `resources` lists a uri, `export_dataset` fetches
  the full set; do that only if the user needs it.
- When `next_actions` is present, it suggests follow-up calls. Use them when
  they fit the question.
- Low `confidence` or thin `coverage` on a small or new domain means the index
  knows little about it. Say that instead of treating zeros as real.

## When a tool returns an error

- `connection_required`: the site has no Google connection for that data.
  Pass on the message; it says what to connect in the Vouched dashboard.
- `upgrade_required`, `quota_exceeded` or `daily_limit_exceeded`: market data
  or the daily allowance isn't available on this account. Tell the user, and
  answer from their own data where possible.
- Any other error: report it with the tool name. Don't guess at the numbers
  it would have returned.

## Answer shape

Lead with the answer ("Clicks fell 18% because three pages lost rankings for
X"), then the evidence with sources, then two or three concrete next steps.
Keep raw tables short; offer the full export instead of pasting it.
