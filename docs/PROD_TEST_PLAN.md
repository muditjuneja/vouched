# Production test plan: every tool on vouchedhq.com

A checklist for one session that verifies the live product end to end:
sign-in, Google connection, every exposed MCP tool, and the plan limits.
Work top to bottom and record a result for every row. Where something
fails, write down what you saw and move on; don't fix things mid-run.

Two roles:
- **You (human):** anything in a browser, anything that pays or signs in.
- **The session (Claude Code):** tool calls through MCP, plus read-only
  checks (`curl`, `wrangler d1 execute --remote` with `SELECT` only).
  It never writes to the production database or changes secrets during
  this run.

## 0. Before starting

Fill these in; every step below uses them.

| Placeholder | What | Example |
|---|---|---|
| `SITE` | A domain you own, verified in Search Console, with real traffic | `example.com` |
| `SITE_PAGE` | One real, indexed URL on it | `https://example.com/pricing` |
| `KNOWN_DOMAIN` | An established third-party site, for market data | `semrush.com` |
| `KNOWN_RIVAL` | A competitor of `KNOWN_DOMAIN` | `ahrefs.com` |

- **Dates for Google:** Search Console lags about 2 to 3 days. Use a
  28-day range ending 3 days ago, e.g. `2026-08-26` to `2026-09-22`.
- **Budget:** the market-data tools spend real money from the DataForSEO
  account (about $24 at the start). One full pass should cost well under
  $2. Note the balance before and after (section 5).
- **Test accounts:** your own Google account must be a test user on the
  OAuth consent screen (Google Auth Platform → Audience), and the Search
  Console API, Analytics Data API and Analytics Admin API must be enabled.

## 1. Account and connection (you, in a browser)

| # | Step | Pass when |
|---|---|---|
| 1.1 | Open `https://vouchedhq.com`, signed out | Nav shows "Cloud", hero shows "Start on Cloud" |
| 1.2 | Click "Start on Cloud", sign in | You land on `/dashboard`, not Clerk's `/default-redirect` and not a 401 loop |
| 1.3 | Check your inbox | Welcome email from `hello@vouchedhq.com`, and its "Open Vouched" link works |
| 1.4 | Open `https://vouchedhq.com` again | Nav shows "Dashboard", hero shows "Open dashboard" |
| 1.5 | Websites → Add website → Connect Google (Search Console) | Google consent, then back on Websites with `SITE` listed under discovered properties |
| 1.6 | Track `SITE`; then connect Analytics and link its GA4 property | Both badges show connected |
| 1.7 | API keys → New key, label `prod-test` | Key shown once; "new API key" email arrives (used in section 5) |

## 2. Connect the session

Connect by signing in (the standard MCP flow), not with the key:

```sh
claude mcp add --transport http vouched-prod https://vouchedhq.com/mcp
```

Then run `/mcp`, pick `vouched-prod`, choose Authenticate, sign in, and click
Allow on the Vouched consent page. Confirm with `describe_capabilities`.

| # | Check | Pass when |
|---|---|---|
| 2.1 | The sign-in above | Browser shows "Allow Claude Code to use Vouched?", naming `localhost` as where access goes, with the "your own computer" warning |
| 2.2 | Settings → Connected apps | The app is listed; don't disconnect it yet |
| 2.3 | In claude.ai: Settings → Connectors → Add custom connector → `https://vouchedhq.com/mcp` → Connect | Same consent page (publisher `claude.ai`); after Allow, the tools list in Claude |
| 2.4 | `curl -si https://vouchedhq.com/mcp -X POST \| grep -i www-authenticate` | Points at `/.well-known/oauth-protected-resource/mcp` |

**Every tool call below also has to pass these general checks:**
- The response is an envelope with `schema_version: "ofe/1.0"`, not an
  error string.
- `facts` is non-empty (unless the row says an empty result is fine), and
  each fact's `provenance.source_class` matches the row.
- `coverage` is present and plausible (`returned` matches what you see).
- Nothing in the response names the data vendor (no "DataForSEO").

## 3. Free tools (work on any plan)

Run these while the account is still on **Free**.

| # | Call | Pass when |
|---|---|---|
| 3.1 | `describe_capabilities {}` | Lists 19 tools; `audit_site` absent or marked not implemented |
| 3.2 | `list_websites {}` | `SITE` present with both connections shown as connected |
| 3.3 | `get_search_performance {domain: SITE, startDate, endDate}` | `gsc.performance_summary` fact with clicks/impressions/ctr/position; `source_class: webmaster_console`, confidence 1 |
| 3.4 | Same call again | Same numbers; `provenance.cache_hit: true` this time |
| 3.5 | `get_search_performance {domain: SITE, startDate, endDate, dimensions: ["query"], rowLimit: 5, compareToPreviousPeriod: true}` | 5 `gsc.query_performance` rows; `deltas` present; if the site has more than 5 queries, `resources` holds an `mcpseo://` URI and `coverage.scope_note` mentions `export_dataset` |
| 3.6 | `export_dataset {uri: <URI from 3.5>}` | Returns more rows than 3.5 did (skip if 3.5 gave no URI) |
| 3.7 | `inspect_indexing {domain: SITE, url: SITE_PAGE}` | `gsc.index_status` fact with a verdict and last-crawl info |
| 3.8 | `list_sitemaps {domain: SITE}` | One fact per submitted sitemap (empty is fine if none are submitted) |
| 3.9 | `get_website_analytics {domain: SITE, startDate, endDate}` | GA4 facts with `source_class: analytics_property` |
| 3.10 | Any market-data tool, e.g. `inspect_keyword {keyword: "seo tools"}` | Fails with `upgrade_required: ...` (Free has no market data) |

## 4. Market-data tools (Pro)

**You:** Billing → upgrade to **Pro** with Dodo's test card. Within a minute
Billing shows Pro, and exactly one "Payment received" email arrives.

| # | Call | Expected `source_class` | Pass when |
|---|---|---|---|
| 4.1 | `inspect_domain {domain: KNOWN_DOMAIN}` | `search_index` | Overview, top keywords and competitors; confidence 0.75 |
| 4.2 | `discover_competitors {domain: KNOWN_DOMAIN, limit: 5}` | `search_index` | Up to 5 competitor domains |
| 4.3 | `research_keywords {seedKeywords: ["seo tools"], limit: 10}` | `search_index` | `seo.keyword_opportunity` facts with volume, KD, CPC |
| 4.4 | `inspect_keyword {keyword: "seo tools"}` | `live_serp` | Volume, difficulty, intent for that one keyword |
| 4.5 | `compare_keyword_coverage {domain: KNOWN_DOMAIN, competitors: [KNOWN_RIVAL]}` | `search_index` | Keywords the rival ranks for that the domain doesn't |
| 4.6 | `inspect_search_visibility {domain: KNOWN_DOMAIN, keywords: ["seo tools", "keyword research"]}` | `live_serp` or `search_index` | A position (or "not ranking") per keyword |
| 4.7 | `inspect_page {url: "https://" + KNOWN_DOMAIN}` | `search_index` | Page-level metrics |
| 4.8 | `inspect_serp {keyword: "seo tools", depth: 10}` | `live_serp` | ~10 `serp.result` facts at 0.85, plus any `serp.feature` facts at 0.6 |
| 4.9 | `inspect_backlinks {domain: KNOWN_DOMAIN, view: "authority"}` | `backlink_index` | Authority metrics. **May fail** if the DataForSEO account has no Backlinks subscription: record the exact error |
| 4.10 | `compare_backlink_gap {domain: KNOWN_DOMAIN, competitors: [KNOWN_RIVAL]}` | `backlink_index` | Linking domains the rival has and the domain lacks. Same subscription caveat as 4.9 |
| 4.11 | `discover_ai_citations {topic: "best seo tools", platform: "google"}` | `ai_answer` | Cited domains from AI Overviews (empty can be legitimate) |
| 4.12 | `inspect_ai_visibility {domain: KNOWN_DOMAIN, competitors: [KNOWN_RIVAL], platform: "google"}` | `ai_answer` | Mention counts for each domain |

**Then check what was recorded** (the session, read-only):

```sh
npx wrangler d1 execute vouched-seo-mcp --remote --command \
  "SELECT tool_name, endpoint, cost_usd, called_at FROM cost_log ORDER BY id DESC LIMIT 15"
```

Pass when every paid call in section 4 has a row with a non-zero cost, and
Billing → usage in the dashboard shows the same total.

## 5. Plans, limits and money

| # | Check | Pass when |
|---|---|---|
| 5.1 | DataForSEO balance before vs after section 4 | Drop roughly matches the `cost_log` total |
| 5.2 | Billing → top up $5 (test mode) | Wallet shows $5 within a minute; one "Wallet credited" email |
| 5.3 | `curl -s -o /dev/null -w "%{http_code}" https://vouchedhq.com/mcp` (no key) | `401` |
| 5.4 | Same with `-H "Authorization: Bearer vsm_wrong"` | `401` |
| 5.5 | Call any tool with the `prod-test` key as a header, then revoke it and call again | Works, then fails as unauthorized (API keys still work next to sign-in) |
| 5.5b | Settings → Connected apps → Disconnect the Claude Code app, then call a tool | Fails; `/mcp` offers sign-in again |
| 5.6 | Settings → Sign out, then open `/dashboard` | Sign-in page, not straight back in |

Optional, if time allows: invite a second email address to a Team plan and
accept from that account (seats); on a Free account, 101 tool calls in a
day hits the daily cap.

## 6. Report

Record one line per row: `3.3 PASS` or `4.9 FAIL: <the exact error text>`.
End with the DataForSEO balance before and after, and a list of failures
to fix. Nothing here should be fixed during the run itself.
