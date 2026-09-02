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

**Cloud offering in progress (M10+)**: this repo is also becoming a hosted,
sellable product — Clerk for auth, Dodo Payments for billing, bundled
DataForSEO access, a dashboard, landing/pSEO pages, and xmit.sh for
transactional email — while self-host (everything below) stays fully
intact and unaffected, gated behind a `CLOUD_MODE` flag. M10 (migrating the
Worker onto Hono, which both Dodo's adapter and the planned SSR
landing/pSEO pages need) and M11 (multi-tenant D1 schema — `tenant_id` on
every table, new `subscriptions`/`usage_counters` tables, every
`src/db/*.ts` helper now tenant-scoped defaulting to `null`/self-host) are
done; self-host behavior is unchanged and still fully tested. **Known
limitation from M11**: `websites.primary_domain`'s uniqueness constraint
predates multi-tenancy and is still global — two cloud tenants can't yet
both track the same domain; fixing it needs a table-rebuild migration
tested against a real D1 instance first (see
`migrations/0002_multi_tenant.sql`'s comment).

**M12 (Clerk auth) is done**: `src/auth/clerk.ts` verifies dashboard
sessions (`verifyToken`, preferring `CLERK_JWT_KEY`'s zero-network-roundtrip
path over `CLERK_SECRET_KEY`); a new `mcp_api_keys` table + `src/db/mcp-
api-keys.ts` gives cloud tenants a separate long-lived key for the `/mcp`
endpoint (a Clerk session expires and isn't meant for static client
config); `/mcp` in cloud mode now checks that key instead of the shared
bearer token, resolving a `tenantId` that flows into `list_websites`,
`get_search_performance`, and `get_website_analytics` (the only tools that
currently need it) via a per-request field on `env`, not a signature change
to all 18 tools — see `Env.__tenantId`'s doc comment for why. The Google
OAuth connect flow (`/oauth/google/start`) is now Clerk-session-gated in
cloud mode instead of the self-host `setup_token`, with the tenant id
riding through Google's `state` param to the callback. **Not built yet,
and needed before this is usable**: any actual UI to sign in, or to create/
view/revoke an MCP API key — that's M15's dashboard. **No Clerk account
was available to test against in this sandbox** — `verifyToken`'s real
behavior (a valid session, a real JWKS/PEM key) is unverified beyond
matching its documented type signature; test against a real Clerk app
before trusting it.

**M13 (Dodo Payments billing) is done**: `GET /billing/checkout?plan=pro
|team&email=...` (Clerk-session-gated, cloud mode only) creates a Dodo
checkout session via `@dodopayments/core`'s `createCheckoutSession` and
redirects to it, stamping the tenant id into the session's `metadata` —
`POST /webhooks/dodo` (via `@dodopayments/hono`'s `Webhooks()`, HMAC-signed
per the Standard Webhooks spec) reads that same `metadata.tenant_id` back
off every subscription event to sync `subscriptions`. `subscriptions.status`
uses Dodo's own real status vocabulary (`pending/active/on_hold/paused/
cancelled/failed/expired`) — confirmed against `@dodopayments/core`'s
actual schema types, which corrected a wrong guess from M11 (`past_due`
isn't a real Dodo status; fixed in place in `migrations/0002_multi_tenant.sql`
since that table was never applied to a real D1 anywhere). **A genuine
verification win**: TypeScript itself caught that Dodo's webhook payloads
arrive as `{type, data}`, not flat fields, when an earlier draft of
`src/billing/webhook-handlers.ts` assumed the wrong shape — the compiler
error was the check here, not a guess. **Still unverified**: no Dodo
account was available to actually send a webhook or complete a checkout in
this sandbox; `@dodopayments/core`'s webhook module also documents using
Node's `crypto` (works via our `nodejs_compat` flag on paper, unconfirmed
under real `workerd`). No dashboard yet to link `/billing/checkout` from —
that's still M15.

M14 onward (bundled DataForSEO quota enforcement, dashboard, pSEO, email)
are in progress.

**All 18 of OpenRush's tools are implemented.** See `docs/ARCHITECTURE.md`
for the full design, `docs/TOOLS.md` for the generated tool-by-tool
reference, and `docs/OFE_ENVELOPE.md` for the shared response shape every
tool returns. Project name is a placeholder — see "Open decisions" below.

**Before you rely on this**, three things this sandboxed build couldn't do:
1. Run `wrangler dev` and `npm test` for real (this sandbox has no network
   egress to Cloudflare's API and a local workerd/Node mismatch — see
   "Known limitation" below).
2. Verify the DataForSEO endpoint wrappers against a real API key — every
   endpoint *path* is confirmed, but field names in `seo`/`serp`/`backlinks`
   are DataForSEO's documented conventions, unverified live, and
   `ai_visibility`'s are a best-effort guess (see Status below).
3. Confirm a Google Cloud OAuth client + Workers Paid plan before
   deploying — both are assumed but not yours to set up automatically.

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
> crash — but confirm against the real API with your own key before
> trusting these outputs, especially `inspect_page`'s and
> `inspect_search_visibility`'s `filters` parameters (the least certain
> part).

**`backlinks` domain** (M7, 2 tools): `inspect_backlinks` (view-selectable:
authority / referring domains / anchors / individual backlinks — one call,
not four) and `compare_backlink_gap` (link gap across up to 5 competitors,
spam-score filtered, with a heuristic earned-link flag). Same field-shape
caveat as `seo`/`serp` above.

**`ai_visibility` domain** (M8, 2 tools): `discover_ai_citations` and
`inspect_ai_visibility`, backed by DataForSEO's AI Optimization / LLM
Mentions API — its newest product area. **This is the lowest-confidence
part of the whole build**: only endpoint paths and general shape were
confirmed this session (see
`src/clients/dataforseo/endpoints/llm-mentions.ts`'s doc comment) — request
field names are a best-effort guess, not verified against docs or a live
call. Spike this against the real API before trusting it, expect to revise
the request body shape.

**All 18 tools in OpenRush's manifest are now implemented** —
`describe_capabilities` reports `implemented: true` across the board. What
remains (M9) is hardening/polish, not new tools: generated docs, an
optional OAuth-provider upgrade for the MCP endpoint, Queue-based crawler
scaling for very large sites, and — most importantly — real verification
against live DataForSEO/Google accounts, which this sandboxed build
couldn't do (see the two caveats above and the sandbox-limitation note).

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
