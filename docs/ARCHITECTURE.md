# Architecture

Full design rationale lives in the build plan this repo was scaffolded from;
this doc is the quick-reference version.

## Layers

- **`src/index.ts`** — the Worker's `fetch()`. Gates every request with a
  shared bearer token, then hands off to `createMcpHandler` (from `agents`,
  the current stateless MCP handler — `McpAgent`/Durable-Object-per-session
  is deprecated as of mid-2026).
- **`src/mcp/server.ts`** — builds a fresh `McpServer` per request, closing
  over that request's `env` (D1/R2 bindings + secrets). This closure is
  *the* mechanism for reaching Worker bindings from tool handlers: the
  handler factory's `McpRequestContext` carries `era`/`authInfo`/
  `requestInfo`, not bindings.
- **`src/domains/<domain>/<tool>.ts`** — one file per tool, each exporting
  `{ name, title, description, inputSchema, handler }`. Handlers never touch
  the MCP SDK directly; they build and return an `Envelope` via
  `src/envelope/builder.ts`.
- **`src/envelope/`** — the OFE (open fact envelope) shape every tool
  returns: `schema_version, domain, data, facts[with provenance], entities,
  coverage, deltas, resources, next_actions`. `builder.ts` is the only place
  that constructs one; `entities.ts` mints canonical ids (`domain:`,
  `keyword:`, `page:`, `property:`, `backlink:`); `provenance.ts` gives each
  fact a source_class + default confidence; `schema.ts` is the zod schema
  used as every tool's `outputSchema`.
- **`src/mcp/manifest.ts`** — the full 18-tool target manifest (confirmed
  against OpenRush's own live `describe_capabilities`), each entry flagged
  `implemented: true/false` so `describe_capabilities` never claims more
  than what's actually registered.
- **`src/db/`** — D1 query helpers. `websites.ts` (tracked sites config),
  `google_tokens.ts` (OAuth token storage, written by M3). Migrations in
  `migrations/`.
- **`src/resources/store.ts`** — R2-backed `mcpseo://` resource URIs, for
  datasets too large to inline (`export_dataset` resolves them).

## Why Cloudflare, and why this shape

- Workers Paid plan's subrequest (10k/invocation) and CPU (up to 5 min)
  limits are enough for a bounded self-crawl or a multi-call tool like
  `inspect_domain` in one invocation — no Queue-based fan-out needed for v1.
- Google's official SDKs (`googleapis`, `google-auth-library`) assume
  Node/ADC-style environments that don't fit Workers; the `gsc`/`analytics`
  domains (M3) instead do plain `fetch()` against Google's OAuth token
  endpoint and the Search Console / GA4 Data REST APIs directly.
- D1 already being load-bearing for config/cost-tracking means real
  `deltas` (diff against a prior observation, stored in the `observations`
  table) are cheap in v1, not a stub.
