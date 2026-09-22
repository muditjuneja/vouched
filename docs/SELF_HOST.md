# Self-hosting

The free, always-available way to run this: your own Cloudflare account,
your own bearer token, optionally your own DataForSEO/Google credentials.
`CLOUD_MODE` stays unset, none of the cloud-offering code in `docs/CLOUD.md`
ever engages.

## Setup

```bash
npm install
wrangler d1 create vouched-seo-mcp        # then paste the database_id into wrangler.jsonc
npm run db:migrate:local
cp .dev.vars.example .dev.vars            # fill in MCP_BEARER_TOKEN at minimum
npm run dev
```

Add it to Claude Code:

```bash
claude mcp add --transport http vouched-seo-mcp http://localhost:8787/mcp \
  --header "Authorization: Bearer <your MCP_BEARER_TOKEN>"
```

Deploying:

```bash
wrangler r2 bucket create vouched-seo-mcp-datasets
wrangler kv namespace create CACHE        # then paste the id into wrangler.jsonc
wrangler secret put MCP_BEARER_TOKEN
npm run db:migrate:remote
npm run deploy
```

DataForSEO and Google OAuth secrets (`DATAFORSEO_LOGIN`/`PASSWORD`,
`GOOGLE_OAUTH_CLIENT_ID`/`SECRET`) are optional, the free tier works with
none of them set. Adding them unlocks the corresponding domains, which
`describe_capabilities` reflects live.

## What you get

**Free tier** (`core`, `audit`, `gsc`, `analytics`, zero paid vendors):
- **`core`** (M1): `describe_capabilities`, `list_websites`, `export_dataset`.
- **`audit`** (M2): `audit_site`, a bounded, robots.txt-aware self-crawl
  (meta/heading/image/indexability/broken-internal-link checks, issue
  clustering, a simple site-health score).
- **`gsc` + `analytics`** (M3): `get_search_performance` and
  `get_website_analytics`, via hand-rolled Google OAuth (no `googleapis`
  SDK, see `docs/ARCHITECTURE.md`) and plain `fetch` against the official
  Search Console / GA4 Data REST APIs. To connect an account, add a row to
  the `websites` D1 table (see `migrations/0001_init.sql`) with its
  `gsc_site_url`/`ga4_property_id`, then visit
  `https://<your-worker>/oauth/google/start?scope=webmaster_console&setup_token=<MCP_BEARER_TOKEN>`
  (and again with `scope=analytics_property`) to grant access.

**DataForSEO-backed tier, `seo` + `serp` domains** (M4-M6, 9 tools):
`inspect_domain`, `discover_competitors`, `research_keywords`,
`compare_keyword_coverage`, `inspect_search_visibility`, `inspect_keyword`,
`inspect_page`, `inspect_serp`. These only register (and only then appear
in `describe_capabilities`) when `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD`
are set.

> **Field-shape caveat**: this build has no DataForSEO API key, so while
> every endpoint *path* used above was confirmed against DataForSEO's own
> `mcp-server-typescript` repo, the request/response *field names* in
> `src/clients/dataforseo/endpoints/*.ts` follow documented conventions but
> are unverified against a live call. Field extraction is written
> defensively (optional chaining, a `raw` passthrough on facts where it
> matters) so a wrong guess degrades to `null`/extra fields rather than a
> crash, but confirm against the real API with your own key before
> trusting these outputs, especially `inspect_page`'s and
> `inspect_search_visibility`'s `filters` parameters (the least certain
> part).

**`backlinks` domain** (M7, 2 tools): `inspect_backlinks` (view-selectable:
authority / referring domains / anchors / individual backlinks, one call,
not four) and `compare_backlink_gap` (link gap across up to 5 competitors,
spam-score filtered, with a heuristic earned-link flag). Same field-shape
caveat as `seo`/`serp` above.

**`ai_visibility` domain** (M8, 2 tools): `discover_ai_citations` and
`inspect_ai_visibility`, backed by DataForSEO's AI Optimization / LLM
Mentions API, its newest product area. **This is the lowest-confidence
part of the whole build**: only endpoint paths and general shape were
confirmed this session (see
`src/clients/dataforseo/endpoints/llm-mentions.ts`'s doc comment), request
field names are a best-effort guess, not verified against docs or a live
call. Spike this against the real API before trusting it, expect to revise
the request body shape.

**17 of 18 tools in OpenRush's manifest are implemented and exposed**,
see [`docs/TOOLS.md`](TOOLS.md) for the live per-tool breakdown.
`audit_site` is built but deliberately held back (`implemented: false`)
until its crawl is reworked to fit this Workers architecture properly
(currently a fully sequential, no-concurrency BFS, see
`src/crawler/crawl.ts`).

## Known limitation of some sandboxed dev environments

`@cloudflare/vitest-pool-workers` and `wrangler dev`/`deploy` both need a
working local `workerd` runtime and (for deploy) real network access to
Cloudflare's API. In network-restricted sandboxes neither may work, this
repo was in fact built and typechecked in one where `wrangler dev` couldn't
reach `workers.cloudflare.com` at all, and `vitest-pool-workers` failed to
boot workerd (`vm._setUnsafeEval is not a function`, a Node/workerd version
mismatch in that sandbox). Pure-logic tests (e.g. `test/unit/envelope/`) run
fine under plain Node either way; anything touching D1/R2 needs an
environment with working `workerd`, a normal dev machine or CI runner.
