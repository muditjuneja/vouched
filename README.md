# mcp-seo-toolkit

An open-source (MIT), self-hosted MCP server for SEO/marketing data on
Cloudflare Workers — a genuinely open alternative to commercial tools like
OpenRush, which despite the name is closed-source and credit-metered.

Two tiers, split by what backs them:

- **Free tier** (`core`, `audit`, `gsc`, `analytics`) — official Google APIs
  (Search Console, GA4) plus a self-crawl. Zero paid vendors, zero markup.
- **DataForSEO-backed tier** (`seo`, `serp`, `backlinks`, `ai_visibility`) —
  same tool shapes, backed by [DataForSEO](https://dataforseo.com/),
  pay-as-you-go with **your own API key** — this server never marks it up.

See `docs/ARCHITECTURE.md` for the full design and `docs/TOOLS.md` for the
tool-by-tool manifest. Project name is a placeholder — see "Open decisions"
below.

## Status

**The free tier is complete** (`core`, `audit`, `gsc`, `analytics` — zero
paid vendors):
- **`core`** (M1): `describe_capabilities`, `list_websites`, `export_dataset`.
- **`audit`** (M2): `audit_site` — a bounded, robots.txt-aware self-crawl
  (meta/heading/image/indexability/broken-internal-link checks, issue
  clustering, a simple site-health score).
- **`gsc` + `analytics`** (M3): `get_search_performance` and
  `get_website_analytics`, via hand-rolled Google OAuth (no `googleapis`
  SDK — see `docs/ARCHITECTURE.md`) and plain `fetch` against the official
  Search Console / GA4 Data REST APIs. To connect an account, add a row to
  the `websites` D1 table (see `migrations/0001_init.sql`) with its
  `gsc_site_url`/`ga4_property_id`, then visit
  `https://<your-worker>/oauth/google/start?scope=webmaster_console&setup_token=<MCP_BEARER_TOKEN>`
  (and again with `scope=analytics_property`) to grant access.

Everything else (the DataForSEO-backed `seo`/`serp`/`backlinks`/`ai_visibility`
domains) is tracked but not yet built — `describe_capabilities` reports
`implemented: false` for those tools honestly rather than pretending they
exist.

## Setup

```bash
npm install
wrangler d1 create mcp-seo-toolkit        # then paste the database_id into wrangler.jsonc
npm run db:migrate:local
cp .dev.vars.example .dev.vars            # fill in MCP_BEARER_TOKEN at minimum
npm run dev
```

Add it to Claude Code:

```bash
claude mcp add --transport http mcp-seo-toolkit http://localhost:8787/mcp \
  --header "Authorization: Bearer <your MCP_BEARER_TOKEN>"
```

Deploying:

```bash
wrangler r2 bucket create mcp-seo-toolkit-datasets
wrangler secret put MCP_BEARER_TOKEN
npm run db:migrate:remote
npm run deploy
```

DataForSEO and Google OAuth secrets (`DATAFORSEO_LOGIN`/`PASSWORD`,
`GOOGLE_OAUTH_CLIENT_ID`/`SECRET`) are optional — the free tier works with
none of them set. Adding them unlocks the corresponding domains, which
`describe_capabilities` reflects live.

## Known limitation of some sandboxed dev environments

`@cloudflare/vitest-pool-workers` and `wrangler dev`/`deploy` both need a
working local `workerd` runtime and (for deploy) real network access to
Cloudflare's API. In network-restricted sandboxes neither may work — this
repo was in fact built and typechecked in one where `wrangler dev` couldn't
reach `workers.cloudflare.com` at all, and `vitest-pool-workers` failed to
boot workerd (`vm._setUnsafeEval is not a function`, a Node/workerd version
mismatch in that sandbox). Pure-logic tests (e.g. `test/unit/envelope/`) run
fine under plain Node either way; anything touching D1/R2 needs an
environment with working `workerd` — a normal dev machine or CI runner.

## Open decisions (not settled by this build)

- **Project name** — `mcp-seo-toolkit` is a placeholder throughout; the
  literal name "OpenRush" is unusable (a commercial product owns it, and an
  unrelated small OSS repo already uses the name too).
  See `LICENSE`'s copyright line as well once a real name/owner is picked.
- **Workers plan** — the crawler (`audit_site`) and multi-call tools like
  `inspect_domain` need the Paid plan's higher CPU/subrequest limits; the
  Free plan's 10ms CPU / 50-subrequest caps won't run them.
- **MCP endpoint auth** — currently a shared bearer token (simplest for a
  personal server). Swap for `@cloudflare/workers-oauth-provider` if this
  should be installable as a discoverable connector instead.
