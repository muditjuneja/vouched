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

**Known limitation, since fixed**: `websites.primary_domain`'s uniqueness
constraint predated multi-tenancy and was still global — two cloud
tenants couldn't both track the same domain. Fixed in
`migrations/0006_website_domain_uniqueness.sql` (a table rebuild, since
SQLite/D1 can't ALTER a column constraint in place) with two partial
unique indexes instead of one compound constraint, so self-host's
original per-domain dedup guarantee (tenant_id always NULL) isn't
silently lost in the process — see that migration's comment.

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

**Payment-failure grace period** (`src/db/subscriptions.ts`'s
`getEffectivePlan`): an `on_hold`/`failed` subscription (Dodo's dunning
retrying a failed charge) keeps its real plan for 3 days past
`current_period_end` before falling back to free — coordinated with
M18's `notifyPaymentFailed` email, which fires the moment the status
changes, so the tenant is warned right when the grace period starts
rather than discovering it via a sudden downgrade. `pending`/`paused`/
`cancelled`/`expired` are deliberate/terminal states with no such
ambiguity — free immediately, same as before.

**Still unverified**: no Dodo account was available to actually send a
webhook or complete a checkout in this sandbox; `@dodopayments/core`'s
webhook module also documents using Node's `crypto` (works via our
`nodejs_compat` flag on paper, unconfirmed under real `workerd`).

## M14 — Bundled DataForSEO + quota enforcement

Done. In cloud mode with a resolved tenant, every DataForSEO call
(`src/clients/dataforseo/client.ts`'s `dfsLivePost`, the single chokepoint
all `seo`/`serp`/`backlinks`/`ai_visibility` tools funnel through) uses the
deployment's bundled account (`CLOUD_DATAFORSEO_LOGIN/PASSWORD`, never the
tenant's own key, cloud has no BYOK path) and checks the tenant's plan
quota first (`src/billing/quotas.ts`: Free $0/mo, Pro $4/mo, Team $20/mo
of underlying DataForSEO cost included, roughly 40% of the plan price so
there's a real ~60% margin on the bundled data itself, leaving room for
Dodo's processing cut, infra, and support). Over quota throws a clear
`QuotaExceededError` (same error-driven-UX pattern as
`ConnectionRequiredError`), unless the tenant has a positive prepaid
overage wallet balance, see M19. Self-host is completely unaffected, the
quota gate only engages when `isCloudMode(env) && tenantId !== null`.

*Amendment (post-M18)*: the quota amounts above replace an earlier
placeholder that set each plan's bundled quota equal to its price
(Pro $10/mo of quota for $10/mo, Team $50/mo for $50/mo), which was
literally zero margin on every active subscriber before even counting
payment-processing fees or infra cost. Caught when the user asked "what
exactly is our cloud service earning?"

## M15 — Dashboard UI (medium scope)

Done. `GET /dashboard` (Clerk-gated — signed-out visitors get a plain
sign-in-link page pointing at `CLERK_SIGN_IN_URL`, a Clerk Account Portal or
custom sign-in page you configure, since which URL that is isn't something
this build can know or verify) shows tracked websites + their GSC/GA4
connection state (with connect links), current plan + usage-vs-quota,
upgrade buttons for Pro/Team (linking to M13's `/billing/checkout`), and
MCP API key management (create — shown once, exactly like a Stripe/GitHub
key reveal — list, revoke). Server-rendered via real JSX components
(`hono/jsx` — see the "Design system" section below); auto-escaped by the
JSX runtime rather than a hand-rolled `esc()`. Landed on "medium scope": a
control-plane dashboard (accounts, billing, keys, connection status)
rather than a full analytics replica — actually using the SEO tools still
happens through Claude/MCP.

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

## Design system

Marketing and the dashboard both render through real JSX components
(`hono/jsx` — a Hono built-in, zero extra dependencies; `tsconfig.json`
sets `jsx: "react-jsx"` / `jsxImportSource: "hono/jsx"`) composed from a
shared `src/design/` package, not two independently hand-rolled
stylesheets. Originally (M15/M16) each surface built its own HTML via
string templates with its own colors/fonts/components, which drifted in
concrete ways (different base font size, a `.callout` radius that
differed under the same class name, no accent-colored buttons on the
dashboard, two different dark-mode mechanisms). Fixed by:

- `src/design/tokens.ts` — the one color system (light/dark custom
  properties, `prefers-color-scheme` + a `data-theme` override hook),
  including `--status-*` tokens for badge colors.
- `src/design/base-styles.ts` — shared typography/component CSS
  (headings, `.btn`/`.btn-primary`, `.badge`, `.callout`, `.card`,
  tables, form inputs) both surfaces render identically.
- `src/design/components/*.tsx` — small, tested, reusable components
  (`Button`, `Badge`, `Callout`, `Card`, `Table`) — see
  `test/unit/design/components.test.tsx`.
- `src/design/render.ts` — `renderToString()`, narrowing `hono/jsx`'s
  `string | Promise<string>` render result down to a plain `string` for
  every page-level render function (every component in this build is
  synchronous, so this is always a plain string in practice).

Each surface keeps its own `Layout.tsx` (`src/marketing/Layout.tsx`,
`src/dashboard/Layout.tsx`) for what's genuinely different — marketing's
wide public layout with SEO metadata (title/description/canonical) vs.
the dashboard's narrow authenticated shell — composing the shared tokens/
base CSS plus a small amount of surface-only CSS. Both directories follow
the same shape: `Layout.tsx`, `components/*.tsx` (surface-specific pieces
— `Nav`/`Footer`/`Hero`/`PricingCard` for marketing;
`ConnectionBadge`/`WebsitesSection`/`BillingSection`/`ApiKeysSection` for
the dashboard), and `pages/*.tsx` (one file per route, composing
components — no more 400+-line files with every page's markup crammed
into one). `test/unit/design/shared-tokens.test.ts` asserts both surfaces
actually embed the identical token block, not two independently-defined
`--accent` values.

## M17 — Cloud hardening

Done.
- **Per-tenant rate limiting** (`src/lib/rate-limit.ts`): a D1-backed
  fixed-window counter (`rate_limit_buckets`, `migrations/0004_hardening.sql`),
  checked on every cloud-mode `/mcp` call after API-key auth, configurable
  via `RATE_LIMIT_PER_MINUTE` (default 60/tenant/minute). Chose a D1 counter
  over Cloudflare's native Rate Limiting binding since the latter's
  `wrangler.jsonc` config couldn't be verified working in this sandbox.
  Self-cleaning: every call also prunes that tenant's own buckets older
  than 5 minutes, so the table doesn't grow forever without needing a
  Cron Trigger (which this build doesn't have).
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

Done. `src/email/client.ts`'s `sendEmail` POSTs to xmit.sh
(`POST https://api.xmit.sh/email/send`, Bearer auth, `{from, to, subject,
html}`) and, like `sendAdminAlert`, never throws — a delivery failure logs
a warning rather than breaking the flow that triggered it.
`src/email/dedup.ts` (backed by `tenant_notifications`,
`migrations/0005_email_notifications.sql`) prevents duplicate sends:
`markNotifiedOnce` for one-time/period-scoped notices, `markNotifiedWithCooldown`
for genuinely recurring ones. `src/email/notifications.ts` holds one sender
per hook point, each resolving the tenant's address on demand via a new
`getTenantEmail` in `src/auth/clerk.ts` (`ClerkClient.users.getUser` — a
real API call, unlike `verifyToken`'s zero-roundtrip session check, since
neither a Clerk session token nor Dodo's webhook payload reliably carries
an email address).

Wired into:
- **Welcome** — a tenant's first `GET /dashboard` visit (approximates
  "signup complete"; no Clerk `user.created` webhook exists in this build).
- **API key issued/rotated** — every `POST /dashboard/api-keys`.
- **Google reconnect nudge** — `GET /dashboard`, when GSC/GA4's connection
  state is `reconnect_required`, cooldown-limited to once per 24h per scope.
- **Billing lifecycle** — `src/billing/webhook-handlers.ts`'s
  `handleSubscriptionActive`/`Renewed` (payment receipt),
  `OnHold`/`Failed` (payment-failed notice, alongside the existing admin
  alert), `Cancelled` (cancellation confirmation) — all independently
  unit-tested (refactored from inline closures into named exported
  functions specifically for this).
- **Quota threshold warning** — `src/clients/dataforseo/client.ts`'s
  `dfsLivePost`, at 80%/100% of the tenant's monthly quota, once per
  threshold per billing period (the notice key itself encodes the period).

**Deliberately not built**: a team-invite email (no multi-seat/invite
mechanism exists anywhere in this codebase yet — Team is currently just a
pricing tier name) and a pSEO lead-capture confirmation (verified: no
marketing page collects an email address, so there's nothing to hook).
Both are documented gaps in `src/email/notifications.ts`, not silently
dropped.

**Flagged unverified from the outset, still true**: xmit.sh's own docs
site (`xmit.sh/docs`) is directly egress-blocked from this sandbox — its
endpoint path and request shape were assembled from indirect web-search
snippets of xmit.sh's own pages, not a fetched doc or a live call.
`XMIT_API_BASE_URL` exists as an override in case the base URL needs
correcting without a code change. Spike against a real xmit.sh API key
before trusting this, same caveat treatment as DataForSEO's
`ai_visibility` endpoints elsewhere in this build.

## M19 — Prepaid overage wallet

Done. Once a tenant is past their plan's bundled DataForSEO quota
(`MONTHLY_QUOTA_USD`, M14), a call is no longer hard-blocked: it goes
through as long as their prepaid overage wallet
(`subscriptions.wallet_balance_usd`, migration `0007_wallet.sql`) has a
positive balance, then gets debited afterward at real cost times
`OVERAGE_MARKUP_MULTIPLIER` (`src/billing/quotas.ts`, currently 1.15x, a
flat convenience markup rather than the ~60% margin baked into the
bundled quota, closer to a processing-and-margin fee in the spirit of
OpenRouter's ~5% BYOK pass-through cut). `QuotaExceededError` still
fires once both the quota and the wallet are exhausted. This works
independently of plan: even a free-plan tenant with no subscription at
all can pay purely out of a wallet balance, no upgrade required.

The wallet is funded via a one-time (non-subscription) Dodo checkout
(`src/billing/dodo-client.ts`'s `startWalletTopup`, a new
`GET /billing/topup` route in `src/index.ts`, same cloud-mode +
Clerk-session gate as `/billing/checkout`) against a single "pay what you
want" Dodo product (`DODO_PRODUCT_ID_WALLET_TOPUP`) with its price
overridden per checkout via `product_cart[].amount`. Crediting happens on
Dodo's `payment.succeeded` webhook (`handlePaymentSucceeded`, new in
`src/billing/webhook-handlers.ts`), guarded so it only fires for a
top-up (cart contains the wallet product), never for a subscription's own
periodic invoice payment. Idempotent against a retried webhook delivery:
`wallet_ledger.dodo_payment_id` carries a unique index, so crediting the
same payment id twice is a no-op. Debiting is a single atomic conditional
`UPDATE ... WHERE wallet_balance_usd >= ?`, so two concurrent overage
calls can't jointly overdraw the balance.

Dashboard shows the wallet balance and a "buy credits" form
(`BillingSection.tsx`, fixed $10/$25/$100 presets from
`TOPUP_PRESETS_USD`). A low-balance warning email
(`notifyLowWalletBalance`) fires at most once per 24h once the balance
drops under $2, mirroring the quota-threshold warning's dedup pattern.

**Still unverified**: `startWalletTopup`'s assumption that Dodo's
`product_cart[].amount` and a payment's `total_amount` are both in the
smallest currency unit (USD cents), matching Stripe-style convention, is
not confirmed against a live Dodo account, only against the vendored SDK's
type declarations (which don't state the unit). Confirm before trusting a
real charge matches what the dashboard's top-up form shows.

**Deliberately not adopted**: Dodo Payments has its own native
subscription-attached credit/overage system
(`credit.added`/`credit.deducted`/`CreditBalanceLow`/
`CreditOverageCharged` webhooks, tied to a per-product "credit
entitlement" configured in the Dodo dashboard) that could replace this
whole wallet. Not used here because it needs product-level credit
entitlement configuration this sandbox has no live account to verify
against, and the per-call quota check needs a synchronous, cheap local
D1 lookup regardless of who the system of record is. Worth revisiting
against a real Dodo account before launch.

## Verification discipline

Same as self-host: typecheck + lint + unit tests (pure logic — tenant-
scoping helpers, quota math, webhook signature verification, rate-limit
buckets) after every milestone; `wrangler dev` re-run for real once outside
this sandbox (still blocked here — no egress to Cloudflare's API); each new
external integration (Clerk, Dodo, xmit.sh) has its unverified assumptions
called out explicitly in code comments and here, not silently assumed
correct.
