<p align="center">
  <img src="assets/brand/mark.svg" alt="Vouched" width="72" height="72">
</p>

<h1 align="center">Vouched</h1>

<p align="center">
  SEO data your AI can cite. An open-source MCP server for Search Console, Google Analytics, keywords, backlinks, live Google results and AI answer visibility.
</p>

<p align="center">
  <a href="https://vouchedhq.com">Website</a> ·
  <a href="https://vouchedhq.com/tools">Tools</a> ·
  <a href="docs/SELF_HOST.md">Self-host</a> ·
  <a href="LICENSE">MIT license</a>
</p>

---

Ask Claude, ChatGPT or Cursor "why did our clicks drop last month?" or "which keywords does our competitor rank for that we don't?" and it answers from real data instead of guessing.

Every tool returns the same JSON envelope. Each fact in it says where it came from, how confident it is and when it was observed, so the agent (and you) can tell a Search Console number from an index estimate.

## Two ways to run it

**Hosted at [vouchedhq.com](https://vouchedhq.com).** Add `https://vouchedhq.com/mcp` as a connector in your AI client and sign in. Your own Google data is free; live market data needs a Pro or Team plan and is billed at cost. See [pricing](https://vouchedhq.com/pricing).

**Self-hosted.** Run the same server on your own Cloudflare account, with your own Google OAuth client and, if you want market data, your own DataForSEO key. No markup, no account with us. See [docs/SELF_HOST.md](docs/SELF_HOST.md).

Both run the same code and expose the same tools.

## Tools

19 tools, all read-only. Nothing is ever written to Google or to any site.

**Your own data** (free; needs a Google connection)

| Tool | What it answers |
|---|---|
| `get_search_performance` | Clicks, impressions, CTR and position by query, page, date, country or device, with period-over-period changes |
| `inspect_indexing` | Is this URL indexed, which canonical did Google pick, when was it last crawled |
| `list_sitemaps` | Submitted sitemaps, with errors, warnings and URL counts |
| `get_website_analytics` | Sessions, users and engagement from GA4 |

**Market data** (DataForSEO on self-host; Pro or Team plan when hosted)

| Tool | What it answers |
|---|---|
| `inspect_domain` | A domain's organic traffic, ranking keywords and main competitors |
| `discover_competitors` | Who competes with a site for the same keywords |
| `research_keywords` | Keyword ideas around seed terms, with volume, difficulty, CPC and intent |
| `inspect_keyword` | How big and how hard one keyword is |
| `inspect_serp` | Who ranks on Google for a query right now, plus AI Overviews and other features |
| `inspect_search_visibility` | Where a domain ranks for a list of keywords |
| `inspect_page` | Keywords and traffic for a single URL |
| `compare_keyword_coverage` | Keywords competitors rank for that you don't |
| `inspect_backlinks` | Authority, referring domains, anchors and individual backlinks |
| `compare_backlink_gap` | Sites linking to competitors but not to you |
| `discover_ai_citations` | Which sites AI answers cite for a topic |
| `inspect_ai_visibility` | How often a domain is mentioned in AI answers compared with competitors |

**Utilities**

| Tool | What it does |
|---|---|
| `describe_capabilities` | What's enabled on this server, and what each tool costs |
| `list_websites` | Your tracked websites and their Google connections |
| `export_dataset` | The full result behind a truncated response, kept for 7 days |

Each tool has a page with inputs, outputs and an example response at [vouchedhq.com/tools](https://vouchedhq.com/tools). The generated reference is [docs/TOOLS.md](docs/TOOLS.md).

## What a response looks like

A trimmed `get_search_performance` result:

```json
{
  "schema_version": "ofe/1.0",
  "domain": "gsc",
  "data": { "domain": "xmit.sh", "startDate": "2026-08-28", "endDate": "2026-09-24", "dimensions": ["query"] },
  "facts": [
    {
      "type": "gsc.query_performance",
      "subject": ["property:...", "keyword:any:GLOBAL:transactional email api"],
      "data": { "dimensions": { "query": "transactional email api" }, "clicks": 41, "impressions": 3120, "ctr": 0.013, "position": 8.2 },
      "provenance": {
        "source_class": "webmaster_console",
        "method": "gsc.searchAnalytics.query",
        "confidence": 1,
        "observed_at": "2026-09-25T08:00:00Z",
        "cache_hit": false
      }
    }
  ],
  "deltas": [{ "fact_type": "gsc.query_performance", "field": "clicks", "previous": 29, "current": 41 }],
  "coverage": { "returned": 25, "total": null, "scope_note": "capped at 25 rows; more are available via export_dataset" },
  "resources": [{ "uri": "mcpseo://gsc/...", "description": "Up to 1000 rows for this same query" }],
  "next_actions": []
}
```

`deltas` compare with the previous period, `coverage` says what the result leaves out, `resources` holds the rest, and `next_actions` suggests follow-up calls when there are useful ones. The full shape is in [docs/OFE_ENVELOPE.md](docs/OFE_ENVELOPE.md).

## Connect a client

Hosted:

```bash
# Claude Code: the plugin (MCP server plus an SEO analysis skill)
claude plugin marketplace add muditjuneja/vouched
claude plugin install vouched@vouched

# Claude Code: the MCP server only
claude mcp add --transport http vouched https://vouchedhq.com/mcp

# Gemini CLI
gemini extensions install https://github.com/muditjuneja/vouched
```

In Claude or ChatGPT, add `https://vouchedhq.com/mcp` as a custom connector. In Cursor, add it to `~/.cursor/mcp.json`:

```json
{ "mcpServers": { "vouched": { "url": "https://vouchedhq.com/mcp" } } }
```

Your client opens a sign-in page the first time (standard MCP OAuth). Clients that can only send a header can use an API key from the dashboard instead.

Self-hosted, point the client at your Worker's `/mcp` URL with your bearer token; see [docs/SELF_HOST.md](docs/SELF_HOST.md).

## Development

```bash
npm install
cp .dev.vars.example .dev.vars   # MCP_BEARER_TOKEN at minimum
npm run db:migrate:local
npm run dev                      # http://localhost:8787/mcp

npm test
npm run typecheck
npm run lint
```

Set `DATAFORSEO_BASE_URL=https://sandbox.dataforseo.com` while developing: DataForSEO's sandbox is free and returns dummy data in the real response shape.

Built on Cloudflare Workers with Hono, D1, R2 and KV. No Google SDK: the Google APIs are called directly.

## Docs

- [Self-hosting](docs/SELF_HOST.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Response envelope](docs/OFE_ENVELOPE.md)
- [Tool reference](docs/TOOLS.md)
- [Hosted service internals](docs/CLOUD.md) and [deploying it](docs/DEPLOY.md)

## Privacy

Google data is read only when you ask for it and is covered by Google's Limited Use requirements. It is never sold, used for ads or used to train AI models. See the [privacy policy](https://vouchedhq.com/privacy).

## Contributing and support

Issues and pull requests are welcome. For the hosted service, email hello@vouchedhq.com.

## License

[MIT](LICENSE)
