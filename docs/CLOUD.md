# Cloud offering

This repo is also a hosted, sellable product — Clerk for auth, Dodo Payments
for billing, bundled DataForSEO access, a dashboard, landing/pSEO pages, and
(pending M18) xmit.sh for transactional email — while self-host
(`docs/SELF_HOST.md`) stays fully intact and unaffected, gated behind a
`CLOUD_MODE` flag. Off (the default) → today's self-host behavior exactly,
byte-for-byte. On (plus `CLERK_SECRET_KEY` at minimum) → everything below
engages.

Run `npm run doctor` any time to see which cloud pieces are configured in
your current `.dev.vars`/secrets.

## Architecture

- **Hono** carries the whole cloud-facing surface (dashboard, marketing/pSEO
  pages, billing routes) — it's what Dodo Payments' own adapter targets, runs
  natively on Workers, and supports SSR so marketing/pSEO pages are real
  server-rendered HTML. `createMcpHandler` mounts as one Hono route
  (`app.all("/mcp", ...)`); MCP internals are unchanged.
- **Two separate auth mechanisms, not one**: a **Clerk session**
  (cookie/JWT) authenticates the **dashboard** (browser, human). A separate
  long-lived **API key issued per tenant** (`mcp_api_keys` table, hashed,
  shown once, rotatable from the dashboard) authenticates the **`/mcp`
  endpoint** (machine/Claude via `claude mcp add --header`) — a Clerk
  session expires and isn't meant for static client config.
- **Multi-tenancy**: shared D1, `tenant_id` (Clerk user id) column added to
  `websites`, `google_tokens`, `cost_log`, `observations`, enforced at the
  query-helper layer (every `src/db/*.ts` helper takes an optional
  `tenantId`, defaulting to `null`/self-host) — not per-tenant databases.
- **Bundled DataForSEO, not BYOK**: cloud tenants use the deployment's own
  `CLOUD_DATAFORSEO_LOGIN/PASSWORD`, metered per-tenant against a flat
  monthly quota — self-host keeps BYOK (`DATAFORSEO_LOGIN/PASSWORD`).
- **Flat Free/Pro/Team tiers** via Dodo Payments, not usage-based billing.
  A hard quota (not overage billing) bounds cost once a tenant hits their
  plan's monthly cap.

## M10 — Hono migration + `CLOUD_MODE` scaffolding

Done. Pure refactor of `src/index.ts` onto Hono with the MCP handler mounted
as a route — self-host behavior unchanged, verified by the pre-existing test
suite passing untouched.

## M11 — Multi-tenant D1 schema

Done. New migration (`migrations/0002_multi_tenant.sql`): `tenant_id` on
existing tables, new `subscriptions` and `usage_counters` tables, every
`src/db/*.ts` helper now tenant-scoped defaulting to `null`/self-host.

**Known limitation**: `websites.primary_domain`'s uniqueness constraint
predates multi-tenancy and is still global — two cloud tenants can't yet
both track the same domain; fixing it needs a table-rebuild migration
tested against a real D1 instance first (see that migration's comment).

## M12 — Clerk auth

Done. `src/auth/clerk.ts` verifies dashboard sessions (`verifyToken`,
preferring `CLERK_JWT_KEY`'s zero-network-roundtrip path over
`CLERK_SECRET_KEY`'s API-call fallback); `mcp_api_keys` +
`src/db/mcp-api-keys.ts` give cloud tenants a separate long-lived key for
the `/mcp` endpoint; `/mcp` in cloud mode checks that key instead of the
shared bearer token, resolving a `tenantId` that flows into
`list_websites`, `get_search_performance`, and `get_website_analytics` (the
only tools that currently need it) via a per-request field on `env`, not a
signature change to all 18 tools — see `Env.__tenantId`'s doc comment for
why. The Google OAuth connect flow (`/oauth/google/start`) is
Clerk-session-gated in cloud mode instead of the self-host `setup_token`,
with the tenant id riding through Google's `state` param to the callback.

**Not verified**: no Clerk account was available to test against in this
sandbox — `verifyToken`'s real behavior (a valid session, a real JWKS/PEM
key) matches its documented type signature only; test against a real Clerk
app before trusting it.

## M13 — Dodo Payments billing

Done. `GET /billing/checkout?plan=pro|team&email=...` (Clerk-session-gated,
cloud mode only) creates a Dodo checkout session via `@dodopayments/core`'s
`createCheckoutSession` and redirects to it, stamping the tenant id into the
session's `metadata`; `POST /webhooks/dodo` (via `@dodopayments/hono`'s
`Webhooks()`, HMAC-signed per the Standard Webhooks spec) reads that same
`metadata.tenant_id` back off every subscription event to sync
`subscriptions`. `subscriptions.status` uses Dodo's own real status
vocabulary (`pending/active/on_hold/paused/cancelled/failed/expired`) —
confirmed against `@dodopayments/core`'s actual schema types, which
corrected a wrong guess from M11 (`past_due` isn't a real Dodo status;
fixed in place in `migrations/0002_multi_tenant.sql` since that table was
never applied to a real D1 anywhere).

**A genuine verification win**: TypeScript itself caught that Dodo's
webhook payloads arrive as `{type, data}`, not flat fields, when an earlier
draft of `src/billing/webhook-handlers.ts` assumed the wrong shape — the
compiler error was the check here, not a guess.

**Still unverified**: no Dodo account was available to actually send a
webhook or complete a checkout in this sandbox; `@dodopayments/core`'s
webhook module also documents using Node's `crypto` (works via our
`nodejs_compat` flag on paper, unconfirmed under real `workerd`).

## M14 — Bundled DataForSEO + quota enforcement

Done. In cloud mode with a resolved tenant, every DataForSEO call
(`src/clients/dataforseo/client.ts`'s `dfsLivePost` — the single chokepoint
all `seo`/`serp`/`backlinks`/`ai_visibility` tools funnel through) uses the
deployment's bundled account (`CLOUD_DATAFORSEO_LOGIN/PASSWORD`, never the
tenant's own key — cloud has no BYOK path) and checks the tenant's plan
quota first (`src/billing/quotas.ts` — Free: $0/mo, Pro: $10/mo, Team:
$50/mo of underlying DataForSEO cost, placeholder amounts to tune against
real margins). Over quota throws a clear `QuotaExceededError` (same
error-driven-UX pattern as `ConnectionRequiredError`), never a silent
block. Self-host is completely unaffected — the quota gate only engages
when `isCloudMode(env) && tenantId !== null`.

## M15 — Dashboard UI (medium scope)

Done. `GET /dashboard` (Clerk-gated — signed-out visitors get a plain
sign-in-link page pointing at `CLERK_SIGN_IN_URL`, a Clerk Account Portal or
custom sign-in page you configure, since which URL that is isn't something
this build can know or verify) shows tracked websites + their GSC/GA4
connection state (with connect links), current plan + usage-vs-quota,
upgrade buttons for Pro/Team (linking to M13's `/billing/checkout`), and
MCP API key management (create — shown once, exactly like a Stripe/GitHub
key reveal — list, revoke). Plain server-rendered HTML via hand-written
escaping (`src/dashboard/html.ts`'s `esc()`) rather than a JSX toolchain
unrun in this sandbox — deliberately simple, not a placeholder. Landed on
"medium scope": a control-plane dashboard (accounts, billing, keys,
connection status) rather than a full analytics replica — actually using
the SEO tools still happens through Claude/MCP.

**Not verified**: no live Clerk/Dodo account to click through the real flow
end-to-end.

## M16 — Landing pages + pSEO infrastructure

Done. `src/marketing/` (self-contained Hono sub-app, mounted at `/` in
`src/index.ts`): the landing page, `/pricing`, comparison pages
(`/vs/ahrefs`, `/vs/semrush`, `/vs/open-seo`), a tool index + one page per
tool in `TOOL_MANIFEST` (`/tools`, `/tools/:slug` — 18 pages, content
derived from the manifest itself, nothing invented), two use-case pages
(`/for/agencies`, `/for/indie-hackers`), and generated `/sitemap.xml` +
`/robots.txt`. Every page is server-rendered with a unique `<title>`, meta
description, and canonical link, and renders dynamically per-request from
static in-repo content — no build step, no DataForSEO calls, no crawler
cost.

**Deliberate v1 simplification**: pages render at request time rather than
being pre-generated at deploy time or edge-cached; since the underlying
content never changes per-request, that's a future optimization, not a
correctness gap.

## M17 — Cloud hardening

Done.
- **Per-tenant rate limiting** (`src/lib/rate-limit.ts`): a D1-backed
  fixed-window counter (`rate_limit_buckets`, `migrations/0004_hardening.sql`),
  checked on every cloud-mode `/mcp` call after API-key auth, configurable
  via `RATE_LIMIT_PER_MINUTE` (default 60/tenant/minute). Chose a D1 counter
  over Cloudflare's native Rate Limiting binding since the latter's
  `wrangler.jsonc` config couldn't be verified working in this sandbox.
- **Billing-failure alerting** (`src/lib/alerts.ts`): `sendAdminAlert`
  posts a `{text, content}` body (Slack- and Discord-webhook compatible) to
  `ADMIN_ALERT_WEBHOOK_URL` when a Dodo subscription goes `on_hold` or
  `failed`, and when a tenant's daily DataForSEO cost crosses its budget
  warning threshold (`src/clients/dataforseo/cost-tracker.ts`). Always logs
  via `console.warn` regardless of whether a webhook is configured, and
  never throws — a failed alert delivery must not break the request that
  triggered it.
- **Secrets checklist**: `npm run doctor` (`scripts/check-env.ts`) now
  reports a "Cloud offering" section — Clerk, Dodo, bundled DataForSEO,
  xmit.sh, and the admin alert webhook, each flagged present/missing.
- **Docs split**: this file, `docs/SELF_HOST.md`, and a shortened README —
  see the repo root for the overview.

## M18 — Transactional email (xmit.sh)

See `docs/SELF_HOST.md`'s sibling status once built; tracked here as
in-progress pending completion, since it touches both tiers' lifecycle
events (signup, API-key issuance, billing, quota, reconnect nudges) rather
than being purely a cloud-only concern. **Flagged unverified from the
outset**: xmit.sh's own docs site was blocked from this sandbox, so its
exact endpoint path and request payload shape are a best-effort guess —
spike against the real API/docs before trusting it, same caveat treatment
as DataForSEO's `ai_visibility` endpoints.

## Verification discipline

Same as self-host: typecheck + lint + unit tests (pure logic — tenant-
scoping helpers, quota math, webhook signature verification, rate-limit
buckets) after every milestone; `wrangler dev` re-run for real once outside
this sandbox (still blocked here — no egress to Cloudflare's API); each new
external integration (Clerk, Dodo, xmit.sh) has its unverified assumptions
called out explicitly in code comments and here, not silently assumed
correct.
