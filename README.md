# mcp-seo-toolkit

An open-source (MIT), self-hostable MCP server for SEO/marketing data on
Cloudflare Workers — a genuinely open alternative to commercial tools like
OpenRush, which despite the name is closed-source and credit-metered. It's
also available as a hosted cloud product for anyone who'd rather not run
their own Worker.

Two tiers, split by what backs them:

- **Free tier** (`core`, `audit`, `gsc`, `analytics`) — official Google APIs
  (Search Console, GA4) plus a self-crawl. Zero paid vendors, zero markup.
- **DataForSEO-backed tier** (`seo`, `serp`, `backlinks`, `ai_visibility`) —
  same tool shapes, backed by [DataForSEO](https://dataforseo.com/).
  Self-host it pay-as-you-go with **your own API key** (never marked up),
  or use the hosted cloud plan, which bundles DataForSEO access into a flat
  monthly price instead.

**All 18 tools in OpenRush's manifest are implemented** —
`describe_capabilities` reports `implemented: true` across the board.

## Two ways to run this

- **Self-host it** — your own Cloudflare account, your own bearer token,
  optionally your own DataForSEO/Google credentials, `CLOUD_MODE` unset.
  Free forever. See **[`docs/SELF_HOST.md`](docs/SELF_HOST.md)** for setup,
  per-domain tool details, and known field-shape caveats.
- **Use the hosted cloud plan** — Clerk auth, Dodo Payments billing,
  bundled DataForSEO access metered against a flat Free/Pro/Team quota, a
  dashboard, and marketing/pSEO pages, all in this same repo behind a
  `CLOUD_MODE` flag that leaves self-host behavior untouched when unset.
  See **[`docs/CLOUD.md`](docs/CLOUD.md)** for the full architecture and
  milestone-by-milestone status.

## Docs

- [`docs/SELF_HOST.md`](docs/SELF_HOST.md) — self-host setup and free/paid
  tier details.
- [`docs/CLOUD.md`](docs/CLOUD.md) — cloud offering architecture, auth,
  billing, quotas, dashboard, marketing/pSEO, and hardening.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — overall system design.
- [`docs/TOOLS.md`](docs/TOOLS.md) — generated tool-by-tool reference.
- [`docs/OFE_ENVELOPE.md`](docs/OFE_ENVELOPE.md) — the shared response
  shape every tool returns.

## Status

M0-M17 are complete and pushed: the full 18-tool self-hosted server, plus
the cloud pivot (Hono migration, multi-tenant D1, Clerk auth, Dodo billing,
bundled-DataForSEO quota enforcement, a dashboard, landing/pSEO pages, rate
limiting, and admin alerting). M18 (transactional email via xmit.sh) is in
progress. Every external integration built without a live account to test
against in this sandbox (DataForSEO field shapes, Clerk, Dodo, xmit.sh) has
its unverified assumptions called out explicitly in code comments and in
the docs above — confirm against the real service before trusting those
specific claims.

Also see the **[known sandbox limitation](docs/SELF_HOST.md#known-limitation-of-some-sandboxed-dev-environments)**
affecting `wrangler dev`/`deploy` and `@cloudflare/vitest-pool-workers` in
network-restricted environments.

## Open decisions (not settled by this build)

- **Project name** — `mcp-seo-toolkit` is a placeholder throughout; the
  literal name "OpenRush" is unusable (a commercial product owns it, and an
  unrelated small OSS repo already uses the name too). See `LICENSE`'s
  copyright line as well once a real name/owner is picked.
- **Workers plan** — the crawler (`audit_site`) and multi-call tools like
  `inspect_domain` need the Paid plan's higher CPU/subrequest limits; the
  Free plan's 10ms CPU / 50-subrequest caps won't run them.
- **MCP endpoint auth (self-host)** — currently a shared bearer token
  (simplest for a personal server). Swap for
  `@cloudflare/workers-oauth-provider` if this should be installable as a
  discoverable connector instead. (Cloud mode already uses per-tenant API
  keys — see `docs/CLOUD.md`.)
