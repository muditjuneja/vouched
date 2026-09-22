# Architecture

Full design rationale lives in the build plan this repo was scaffolded from;
this doc is the quick-reference version.

## Layers

- **`src/index.ts`**: the Worker's `fetch()`. Gates every request with a
  shared bearer token, then hands off to `createMcpHandler` (from `agents`,
  the current stateless MCP handler, `McpAgent`/Durable-Object-per-session
  is deprecated as of mid-2026).
- **`src/mcp/server.ts`**: builds a fresh `McpServer` per request, closing
  over that request's `env` (D1/R2 bindings + secrets). This closure is
  *the* mechanism for reaching Worker bindings from tool handlers: the
  handler factory's `McpRequestContext` carries `era`/`authInfo`/
  `requestInfo`, not bindings.
- **`src/domains/<domain>/<tool>.ts`**: one file per tool, each exporting
  `{ name, title, description, inputSchema, handler }`. Handlers never touch
  the MCP SDK directly; they build and return an `Envelope` via
  `src/envelope/builder.ts`.
- **`src/envelope/`**: the OFE (open fact envelope) shape every tool
  returns: `schema_version, domain, data, facts[with provenance], entities,
  coverage, deltas, resources, next_actions`. `builder.ts` is the only place
  that constructs one; `entities.ts` mints canonical ids (`domain:`,
  `keyword:`, `page:`, `property:`, `backlink:`); `provenance.ts` gives each
  fact a source_class + default confidence; `schema.ts` is the zod schema
  used as every tool's `outputSchema`.
- **`src/mcp/manifest.ts`**: OpenRush's own 18-tool manifest (confirmed
  against its live `describe_capabilities`) plus 2 more (`inspect_indexing`,
  `list_sitemaps`) added once real gaps in this build's own GSC coverage
  turned up, 20 total. Each entry flagged `implemented` so
  `describe_capabilities` never claims more than what's actually
  registered, 19 of 20 today; `audit_site` is built but deliberately held
  back (`implemented: false`) until its crawl is reworked to fit this
  Workers architecture properly (fully sequential, no concurrency, see
  `src/crawler/crawl.ts`). `src/mcp/server.ts` separately splits
  `FREE_TOOL_MODULES` from `DATAFORSEO_TOOL_MODULES` and only registers
  the latter when `DATAFORSEO_LOGIN`/`PASSWORD` are set, a tool being
  "implemented" and a tool being "enabled right now" are different
  questions, both answered honestly.
- **`src/clients/`**: `dataforseo/` (Basic-auth client, D1-backed cost
  tracker, one `endpoints/*.ts` file per DataForSEO product area) and
  `google/` (plain `fetch` wrappers for Search Console + GA4 Data REST).
  `search-console.ts` covers 3 distinct GSC REST surfaces, not just
  `searchAnalytics.query`: `sitemaps.list` (`listSitemaps`) and the
  separate `/v1/urlInspection/index:inspect` endpoint (`inspectUrl`, a
  different API version/host from the rest of the file) back
  `list_sitemaps`/`inspect_indexing` respectively.
- **`src/domains/gsc/shared.ts`**: `cachedGscCall`, the one place every
  `gsc` domain tool funnels its live Google calls through: a short-TTL KV
  cache, see `src/lib/cache.ts`. Users' Search Console data is never
  archived beyond that cache (Google's Limited Use rules).
- **`src/crawler/`**: the self-crawl behind `audit_site`: robots.txt
  parsing, a bounded BFS, per-page checks, issue clustering.
- **`src/db/`**: D1 query helpers. `websites.ts` (tracked sites config),
  `google_tokens.ts` (OAuth token storage). Migrations in `migrations/`.
- **`src/lib/cache.ts`**: a generic short-TTL cache on the `CACHE` KV
  binding (`getOrSetCache`, keyed by whatever the caller passes in). Every
  `gsc` domain tool goes through it via `src/domains/gsc/shared.ts`'s
  `cachedGscCall`, so an identical query within the TTL never re-hits Google, and
  each fact's `provenance.cache_hit` reflects the real hit/miss instead of
  being a permanent `false`.
- **`src/resources/store.ts`**: R2-backed `mcpseo://` resource URIs, for
  datasets too large to inline. Now actually exercised by
  `get_search_performance`, which fetches one extra, larger page only when
  its own `rowLimit` visibly truncated the result, and spills the fuller
  set here so `export_dataset` has something real to hand back; every
  other tool still doesn't populate this.

## Why Cloudflare, and why this shape

- Workers Paid plan's subrequest (10k/invocation) and CPU (up to 5 min)
  limits are enough for a bounded self-crawl or a multi-call tool like
  `inspect_domain` in one invocation, no Queue-based fan-out needed for v1.
- Google's official SDKs (`googleapis`, `google-auth-library`) assume
  Node/ADC-style environments that don't fit Workers; the `gsc`/`analytics`
  domains (M3) instead do plain `fetch()` against Google's OAuth token
  endpoint and the Search Console / GA4 Data REST APIs directly.
- D1 already being load-bearing for config/cost-tracking means real
  `deltas` (diff against a prior observation, stored in the `observations`
  table) are cheap to add, the table exists from M0, no tool writes to it
  yet (see `docs/OFE_ENVELOPE.md`'s "what's real vs. deferred" section).
  `get_search_performance`'s own `deltas` (period-over-period) are a
  different, narrower mechanism: two live queries diffed against each
  other in one call, not a snapshot read back from `observations`, a real
  gap still open for whichever tool wants "changed since I last asked this
  exact question" instead.

## Future upgrades (documented, not built)

These are deliberately out of scope for the current build, noted here so
they're a decision to make later, not a gap someone has to rediscover:

- **`@cloudflare/workers-oauth-provider`** in place of the shared bearer
  token, if this server should be installable as a discoverable MCP
  connector rather than added manually with `claude mcp add --header`.
- **Queue-based crawler scaling**: `audit_site` runs a bounded BFS in one
  Worker invocation (see the subrequest/CPU limits note above); auditing
  sites with thousands of pages would need enqueuing crawl targets and
  aggregating results across multiple invocations instead.
- **Cloudflare's Browser Rendering binding** as an optional upgrade path
  for `audit_site` against JS-heavy (client-rendered) targets, where a
  plain `fetch` + cheerio parse sees an empty shell.
- **Cron Triggers** for periodically refreshing/pre-warming `gsc`/`analytics`
  data ahead of a request, rather than the on-demand KV caching
  `get_search_performance` already has (see `src/lib/cache.ts`).
- **Per-website Google account binding**: `getAnyToken` (see
  `src/db/google-tokens.ts`) currently assumes one connected account per
  scope group; multiple Google accounts owning different tracked websites
  would need `websites` to record which account each site belongs to.
