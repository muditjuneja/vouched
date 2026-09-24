# Cloud offering

This repo is also a hosted, sellable product, Clerk for auth, Dodo Payments
for billing, bundled DataForSEO access, a dashboard, landing/pSEO pages, and
(pending M18) xmit.sh for transactional email, while self-host
(`docs/SELF_HOST.md`) stays fully intact and unaffected, gated behind a
`CLOUD_MODE` flag. Off (the default) → today's self-host behavior exactly,
byte-for-byte. On (plus `CLERK_SECRET_KEY` at minimum) → everything below
engages.

Run `npm run doctor` any time to see which cloud pieces are configured in
your current `.dev.vars`/secrets.

## Architecture

- **Hono** carries the whole cloud-facing surface (dashboard, marketing/pSEO
  pages, billing routes), it's what Dodo Payments' own adapter targets, runs
  natively on Workers, and supports SSR so marketing/pSEO pages are real
  server-rendered HTML. `createMcpHandler` mounts as one Hono route
  (`app.all("/mcp", ...)`); MCP internals are unchanged.
- **Two separate auth mechanisms, not one**: a **Clerk session**
  (cookie/JWT) authenticates the **dashboard** (browser, human). A separate
  long-lived **API key issued per tenant** (`mcp_api_keys` table, hashed,
  shown once, rotatable from the dashboard) authenticates the **`/mcp`
  endpoint** (machine/Claude via `claude mcp add --header`), a Clerk
  session expires and isn't meant for static client config.
- **Multi-tenancy**: shared D1, `tenant_id` (Clerk user id) column added to
  `websites`, `google_tokens`, `cost_log`, `observations`, enforced at the
  query-helper layer (every `src/db/*.ts` helper takes an optional
  `tenantId`, defaulting to `null`/self-host), not per-tenant databases.
- **Bundled DataForSEO, not BYOK**: cloud tenants use the deployment's own
  `CLOUD_DATAFORSEO_LOGIN/PASSWORD`, metered per-tenant against a flat
  monthly quota, self-host keeps BYOK (`DATAFORSEO_LOGIN/PASSWORD`).
- **Flat Free/Pro/Team tiers** via Dodo Payments, not usage-based billing.
  A hard quota (not overage billing) bounds cost once a tenant hits their
  plan's monthly cap.

## M10: Hono migration + `CLOUD_MODE` scaffolding

Done. Pure refactor of `src/index.ts` onto Hono with the MCP handler mounted
as a route, self-host behavior unchanged, verified by the pre-existing test
suite passing untouched.

## M11: Multi-tenant D1 schema

Done. New migration (`migrations/0002_multi_tenant.sql`): `tenant_id` on
existing tables, new `subscriptions` and `usage_counters` tables, every
`src/db/*.ts` helper now tenant-scoped defaulting to `null`/self-host.

**Known limitation, since fixed**: `websites.primary_domain`'s uniqueness
constraint predated multi-tenancy and was still global, two cloud
tenants couldn't both track the same domain. Fixed in
`migrations/0006_website_domain_uniqueness.sql` (a table rebuild, since
SQLite/D1 can't ALTER a column constraint in place) with two partial
unique indexes instead of one compound constraint, so self-host's
original per-domain dedup guarantee (tenant_id always NULL) isn't
silently lost in the process, see that migration's comment.

## M12: Clerk auth

Done. `src/auth/clerk.ts` verifies dashboard sessions (`verifyToken`,
preferring `CLERK_JWT_KEY`'s zero-network-roundtrip path over
`CLERK_SECRET_KEY`'s API-call fallback); `mcp_api_keys` +
`src/db/mcp-api-keys.ts` give cloud tenants a separate long-lived key for
the `/mcp` endpoint; `/mcp` in cloud mode checks that key instead of the
shared bearer token, resolving a `tenantId` that flows into
`list_websites`, `get_search_performance`, and `get_website_analytics` (the
only tools that currently need it) via a per-request field on `env`, not a
signature change to all 18 tools, see `Env.__tenantId`'s doc comment for
why. The Google OAuth connect flow (`/oauth/google/start`) is
Clerk-session-gated in cloud mode instead of the self-host `setup_token`,
with the tenant id riding through Google's `state` param to the callback.

**Not verified**: no Clerk account was available to test against in this
sandbox, `verifyToken`'s real behavior (a valid session, a real JWKS/PEM
key) matches its documented type signature only; test against a real Clerk
app before trusting it.

**Confirmed broken against a real Clerk app (2026-09-22)**: signing in via
Clerk's hosted Account Portal and getting redirected back to `/dashboard`
loops on 401 forever. Root cause: `verifyClerkSession` only ever checks an
`Authorization: Bearer` header or a `__session` cookie. In a local/dev
setup, Clerk's Account Portal lives on a different origin than this app
(`*.accounts.dev` vs `localhost:8787`), so it redirects back with a
`__clerk_db_jwt` query param instead of a same-origin cookie. That handoff
is normally completed by Clerk's *frontend* JS (`@clerk/clerk-js`) running
on the receiving page, which exchanges it for a real `__session` cookie in
the browser. This codebase has no Clerk frontend integration anywhere (no
script tag, no `publishableKey`, no `CLERK_PUBLISHABLE_KEY` env var at
all), so that token is never consumed, no cookie is ever set, and every
subsequent request has nothing to verify.

Needs, before cloud mode's sign-in flow is usable end to end:
- A `CLERK_PUBLISHABLE_KEY` env var (client-side key, distinct from the
  server-side `CLERK_SECRET_KEY`/`CLERK_JWT_KEY` already here).
- Some client-side Clerk JS on whichever page receives the post-sign-in
  redirect (`@clerk/clerk-js`'s browser bundle via a plain `<script>` tag
  is enough, no framework required) to complete the `__clerk_db_jwt`
  handoff into a real `__session` cookie before the page ever calls
  `/dashboard`.
- A real, in-app sign-in entry point (the landing page currently links
  straight to `CLERK_SIGN_IN_URL` with no handling for the return trip),
  the "Sign in" button flagged in M16 predates this finding and needs
  revisiting alongside it.

## M13: Dodo Payments billing

Done. `GET /billing/checkout?plan=pro|team&email=...` (Clerk-session-gated,
cloud mode only) creates a Dodo checkout session via `@dodopayments/core`'s
`createCheckoutSession` and redirects to it, stamping the tenant id into the
session's `metadata`; `POST /webhooks/dodo` (via `@dodopayments/hono`'s
`Webhooks()`, HMAC-signed per the Standard Webhooks spec) reads that same
`metadata.tenant_id` back off every subscription event to sync
`subscriptions`. `subscriptions.status` uses Dodo's own real status
vocabulary (`pending/active/on_hold/paused/cancelled/failed/expired`),
confirmed against `@dodopayments/core`'s actual schema types, which
corrected a wrong guess from M11 (`past_due` isn't a real Dodo status;
fixed in place in `migrations/0002_multi_tenant.sql` since that table was
never applied to a real D1 anywhere).

**A genuine verification win**: TypeScript itself caught that Dodo's
webhook payloads arrive as `{type, data}`, not flat fields, when an earlier
draft of `src/billing/webhook-handlers.ts` assumed the wrong shape, the
compiler error was the check here, not a guess.

**Payment-failure grace period** (`src/db/subscriptions.ts`'s
`getEffectivePlan`): an `on_hold`/`failed` subscription (Dodo's dunning
retrying a failed charge) keeps its real plan for 3 days past
`current_period_end` before falling back to free, coordinated with
M18's `notifyPaymentFailed` email, which fires the moment the status
changes, so the tenant is warned right when the grace period starts
rather than discovering it via a sudden downgrade. `pending`/`paused`/
`cancelled`/`expired` are deliberate/terminal states with no such
ambiguity, free immediately, same as before.

**Still unverified**: no Dodo account was available to actually send a
webhook or complete a checkout in this sandbox; `@dodopayments/core`'s
webhook module also documents using Node's `crypto` (works via our
`nodejs_compat` flag on paper, unconfirmed under real `workerd`).

## M14: Bundled DataForSEO + quota enforcement

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

## M15: Dashboard UI (medium scope)

Done. `GET /dashboard` (Clerk-gated, signed-out visitors get a plain
sign-in-link page pointing at `CLERK_SIGN_IN_URL`, a Clerk Account Portal or
custom sign-in page you configure, since which URL that is isn't something
this build can know or verify) shows tracked websites + their GSC/GA4
connection state (with connect links), current plan + usage-vs-quota,
upgrade buttons for Pro/Team (linking to M13's `/billing/checkout`), and
MCP API key management (create, shown once, exactly like a Stripe/GitHub
key reveal, list, revoke). Server-rendered via real JSX components
(`hono/jsx`, see the "Design system" section below); auto-escaped by the
JSX runtime rather than a hand-rolled `esc()`. Landed on "medium scope": a
control-plane dashboard (accounts, billing, keys, connection status)
rather than a full analytics replica, actually using the SEO tools still
happens through Claude/MCP.

**Not verified**: no live Clerk/Dodo account to click through the real flow
end-to-end.

## M16: Landing pages + pSEO infrastructure

Done. `src/marketing/` (self-contained Hono sub-app, mounted at `/` in
`src/index.ts`): the landing page, `/pricing`, comparison pages
(`/vs/ahrefs`, `/vs/semrush`), a tool index + one page per
tool in `TOOL_MANIFEST` (`/tools`, `/tools/:slug`, 18 pages, content
derived from the manifest itself, nothing invented), two use-case pages
(`/for/agencies`, `/for/indie-hackers`), and generated `/sitemap.xml` +
`/robots.txt`. Every page is server-rendered with a unique `<title>`, meta
description, and canonical link, and renders dynamically per-request from
static in-repo content, no build step, no DataForSEO calls, no crawler
cost.

**Deliberate v1 simplification**: pages render at request time rather than
being pre-generated at deploy time or edge-cached; since the underlying
content never changes per-request, that's a future optimization, not a
correctness gap.

## Design system

Marketing and the dashboard both render through real JSX components
(`hono/jsx`, a Hono built-in, zero extra dependencies; `tsconfig.json`
sets `jsx: "react-jsx"` / `jsxImportSource: "hono/jsx"`) composed from a
shared `src/design/` package, not two independently hand-rolled
stylesheets. Originally (M15/M16) each surface built its own HTML via
string templates with its own colors/fonts/components, which drifted in
concrete ways (different base font size, a `.callout` radius that
differed under the same class name, no accent-colored buttons on the
dashboard, two different dark-mode mechanisms). Fixed by:

- `src/design/tokens.ts`, the one color system (light/dark custom
  properties, `prefers-color-scheme` + a `data-theme` override hook),
  including `--status-*` tokens for badge colors.
- `src/design/base-styles.ts`, shared typography/component CSS
  (headings, `.btn`/`.btn-primary`, `.badge`, `.callout`, `.card`,
  tables, form inputs) both surfaces render identically.
- `src/design/components/*.tsx`, small, tested, reusable components
  (`Button`, `Badge`, `Callout`, `Card`, `Table`), see
  `test/unit/design/components.test.tsx`.
- `src/design/render.ts`, `renderToString()`, narrowing `hono/jsx`'s
  `string | Promise<string>` render result down to a plain `string` for
  every page-level render function (every component in this build is
  synchronous, so this is always a plain string in practice).

Each surface keeps its own `Layout.tsx` (`src/marketing/Layout.tsx`,
`src/dashboard/Layout.tsx`) for what's genuinely different, marketing's
wide public layout with SEO metadata (title/description/canonical) vs.
the dashboard's narrow authenticated shell, composing the shared tokens/
base CSS plus a small amount of surface-only CSS. Both directories follow
the same shape: `Layout.tsx`, `components/*.tsx` (surface-specific pieces:
`Nav`/`Footer`/`Hero`/`PricingCard` for marketing;
`ConnectionBadge`/`WebsitesSection`/`BillingSection`/`ApiKeysSection` for
the dashboard), and `pages/*.tsx` (one file per route, composing
components, no more 400+-line files with every page's markup crammed
into one). `test/unit/design/shared-tokens.test.ts` asserts both surfaces
actually embed the identical token block, not two independently-defined
`--accent` values.

## M17: Cloud hardening

Done.
- **Superseded (2026-09-24):** the D1 limiter below was replaced by
  Cloudflare's native Rate Limiting binding (`wrangler.jsonc` `ratelimits`,
  free 10/min, paid 60/min, picked per request by plan in `src/index.ts`),
  now a first-class wrangler config instead of the unverifiable
  `unsafe.bindings` entry that ruled it out originally. Free-tier tenants
  also get an exact daily cap of `FREE_DAILY_TOOL_CALLS` tool calls
  (`src/db/daily-tool-calls.ts`, `src/mcp/daily-cap.ts`, counted per tool
  call, not per raw request). `migrations/0008_native_rate_limit_and_daily_cap.sql`
  drops `rate_limit_buckets`. `RATE_LIMIT_PER_MINUTE` no longer exists.
- **Per-tenant rate limiting** (`src/lib/rate-limit.ts`, removed): a D1-backed
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
  never throws, a failed alert delivery must not break the request that
  triggered it.
- **Secrets checklist**: `npm run doctor` (`scripts/check-env.ts`) now
  reports a "Cloud offering" section, Clerk, Dodo, bundled DataForSEO,
  xmit.sh, and the admin alert webhook, each flagged present/missing.
- **Docs split**: this file, `docs/SELF_HOST.md`, and a shortened README,
  see the repo root for the overview.

## M18: Transactional email (xmit.sh)

Done. `src/email/client.ts`'s `sendEmail` POSTs to xmit.sh
(`POST https://api.xmit.sh/email/send`, Bearer auth, `{from, to, subject,
html}`) and, like `sendAdminAlert`, never throws, a delivery failure logs
a warning rather than breaking the flow that triggered it.
`src/email/dedup.ts` (backed by `tenant_notifications`,
`migrations/0005_email_notifications.sql`) prevents duplicate sends:
`markNotifiedOnce` for one-time/period-scoped notices, `markNotifiedWithCooldown`
for genuinely recurring ones. `src/email/notifications.ts` holds one sender
per hook point, each resolving the tenant's address on demand via a new
`getTenantEmail` in `src/auth/clerk.ts` (`ClerkClient.users.getUser`, a
real API call, unlike `verifyToken`'s zero-roundtrip session check, since
neither a Clerk session token nor Dodo's webhook payload reliably carries
an email address).

Wired into:
- **Welcome**: a tenant's first `GET /dashboard` visit (approximates
  "signup complete"; no Clerk `user.created` webhook exists in this build).
- **API key issued/rotated**: every `POST /dashboard/api-keys`.
- **Google reconnect nudge**: `GET /dashboard`, when GSC/GA4's connection
  state is `reconnect_required`, cooldown-limited to once per 24h per scope.
- **Billing lifecycle**: `src/billing/webhook-handlers.ts`'s
  `handleSubscriptionActive`/`Renewed` (payment receipt),
  `OnHold`/`Failed` (payment-failed notice, alongside the existing admin
  alert), `Cancelled` (cancellation confirmation), all independently
  unit-tested (refactored from inline closures into named exported
  functions specifically for this).
- **Quota threshold warning**: `src/clients/dataforseo/client.ts`'s
  `dfsLivePost`, at 80%/100% of the tenant's monthly quota, once per
  threshold per billing period (the notice key itself encodes the period).

**Deliberately not built**: a pSEO lead-capture confirmation (verified: no
marketing page collects an email address, so there's nothing to hook).
A documented gap in `src/email/notifications.ts`, not silently dropped.
(The team-invite email this section used to list as missing now exists,
see M21.)

**Flagged unverified from the outset, still true**: xmit.sh's own docs
site (`xmit.sh/docs`) is directly egress-blocked from this sandbox, its
endpoint path and request shape were assembled from indirect web-search
snippets of xmit.sh's own pages, not a fetched doc or a live call.
`XMIT_API_BASE_URL` exists as an override in case the base URL needs
correcting without a code change. Spike against a real xmit.sh API key
before trusting this, same caveat treatment as DataForSEO's
`ai_visibility` endpoints elsewhere in this build.

## M19: Prepaid overage wallet

Done. Once a tenant is past their plan's bundled DataForSEO quota
(`MONTHLY_QUOTA_USD`, M14), a call is no longer hard-blocked: it goes
through as long as their prepaid overage wallet
(`subscriptions.wallet_balance_usd`, migration `0007_wallet.sql`) has a
positive balance, then gets debited afterward at real cost times
`OVERAGE_MARKUP_MULTIPLIER` (`src/billing/quotas.ts`, currently 1.15x, a
flat convenience markup rather than the ~60% margin baked into the
bundled quota, closer to a processing-and-margin fee in the spirit of
OpenRouter's ~5% BYOK pass-through cut). `QuotaExceededError` still
fires once both the quota and the wallet are exhausted.

**Changed in M21**: the wallet no longer works without a plan. A free
tenant can't top up (`/billing/topup` returns 403) and can't make paid
market-data calls at all, even with an existing balance
(`UpgradeRequiredError`). Otherwise wallet pay-as-you-go strictly beat
both subscriptions.

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

## M20: Sidebar dashboard shell + real per-feature pages

Done. M15's dashboard was one flat page with three sections stacked on
top of each other (websites, plan+wallet, API keys) and no navigation at
all. Replaced with a real app shell: `src/dashboard/components/Sidebar.tsx`
(Overview/Websites/Usage/Billing/Settings, server-computed active-item
highlighting via a literal `activePath` each page's own render function
passes in, no client JS needed for that) and five real pages under
`/dashboard/*`, all still behind M12's single Clerk-auth gate:

- **Overview** (`/dashboard`, renamed from the old single page): plan,
  usage-vs-quota, wallet balance, website count as `StatCard` tiles, plus
  a "recent activity" table (last 5 `cost_log` rows via the new
  `listCostLog`).
- **Websites** (`/dashboard/websites`): the existing add/list table plus
  real edit (`/websites/:id/edit` GET, `/update` POST) and delete
  (`/delete` POST) actions, backed by new `updateWebsite`/`deleteWebsite`/
  `getWebsiteById` functions in `src/db/websites.ts` (all `tenant_id IS ?`
  scoped, confirmed no other table has a `website_id` foreign key, so a
  hard delete needs no cleanup elsewhere).
- **Usage** (`/dashboard/usage`): the per-call `cost_log` table finally
  has a page: `listCostLog` cursor-paginates on `cost_log.id` (not
  `called_at`, since multiple calls can share a timestamp).
- **Billing** (`/dashboard/billing`): plan/quota + wallet sections
  (unchanged logic) plus a new wallet-ledger transaction history
  (`listWalletLedger`, `wallet_ledger` already existed with no reader
  until now), a "Manage billing" link to a new `/billing/portal` route,
  and a payment-status warning banner (see below).
- **API keys** (`/dashboard/api-keys`): its own page (originally part of
  Settings), with key creation in a slide-over drawer like Add website.
- **Settings** (`/dashboard/settings`): account email (`getTenantEmail`)
  and a new Google-connections section
  with a disconnect action (`deleteToken`, new in
  `src/db/google-tokens.ts`); connect links stay on both Websites and
  Settings by deliberate choice (redundant, but connecting is idempotent
  and harmless either way); disconnect only lives in Settings since it
  isn't tied to any one website.

**Two real gaps found and fixed along the way, not just plumbing**:
- Subscription *status* (`on_hold`/`failed`, not just the collapsed
  *plan*) was never surfaced anywhere in the dashboard: only
  `getEffectivePlan` was ever called, which silently keeps a failed
  payment's plan alive through its grace period with zero in-app
  warning. `PaymentStatusBanner` (shown on Overview + Billing) fixes
  this, linking to `/billing/portal`.
- `/billing/success` was a dead-end static text page. `/billing/checkout`
  and `/billing/topup`'s `returnUrl` now point at
  `/dashboard/billing?checkout=success` / `?topup=success` instead, and
  `BillingPage` shows a "payment received, updating shortly" banner
  (phrased as pending, not done, since webhook processing is async).

**`/billing/portal`** (`src/index.ts`) is a new authenticated route
returning a hosted Dodo customer-portal link, via a new
`startCustomerPortalSession` in `src/billing/dodo-client.ts`. Deliberately
not the vendored `@dodopayments/hono` `CustomerPortal` handler: that
handler trusts a bare `customer_id` from the request's own query string
with no session/ownership check at all (confirmed directly in
`@dodopayments/hono`'s source), which would let any caller view/manage
another tenant's billing portal by guessing an id. This route instead
resolves `dodo_customer_id` from the signed-in tenant's own `subscriptions`
row, the same trust pattern `/billing/checkout` already uses.

**Considered and deferred, not adopted this pass**: moving Google OAuth
to Clerk-managed connections (`@clerk/backend` exposes
`users.getUserOauthAccessToken`, confirmed real, which would remove
`google-tokens.ts`'s own storage/refresh logic entirely), needs a Custom
OAuth connection configured in Clerk's dashboard for GSC/Analytics scopes
beyond Clerk's default Google sign-in scopes, and it's unconfirmed
whether Clerk's hosted Account Portal alone can drive connecting a
custom-scoped provider without embedding `@clerk/clerk-js` for the first
time in this otherwise 100%-server-rendered app. Also deferred: CSV/data
export (no export infra anywhere in the app), a subscription-status
history table (today's single-current-row model is sufficient for
everything in this pass), wallet-ledger pagination past the latest 20.

New design-system components (`src/design/`): `NavItem`, `StatCard`,
`Pagination`, same prop-shape conventions as the existing `Button`/
`Badge`/`Card`/`Table`. Mobile sidebar collapse is a `<details>/<summary>`
disclosure (same pattern the marketing pricing page's FAQ already uses),
not a checkbox or any new script, this app still has zero client JS
framework, by design.

## M21: Plan split (Option C) + Team seats

**Why**: wallet pay-as-you-go was strictly cheaper than both subscriptions
(Pro always cost more for the same usage, and Team cost more still), so
nobody had a reason to subscribe. Two changes fix that.

**Plan split**:
- **Free** is your own Google data only (GSC, GA4, core tools), capped at
  `FREE_DAILY_TOOL_CALLS` (100) tool calls per day.
- **Paid market data** (the DataForSEO-backed `seo`/`serp`/`backlinks`/
  `ai_visibility` tools) needs Pro or Team. The gate is in `dfsLivePost`,
  before the quota and wallet checks, and it surfaces to the agent as
  `upgrade_required: ...`.
- **Wallet top-ups** are Pro/Team only. A balance left over after a
  downgrade stays frozen, not refunded or spent, until the tenant
  resubscribes.

**Team seats**: the flat $50 Team plan includes `TEAM_SEATS` (5) people,
counting the owner.
- Tables: `tenant_members`, `tenant_invites`, and
  `mcp_api_keys.created_by`, all in migration
  `0009_team_seats.sql`.
- **The tenant model doesn't change.** A workspace's id is still its
  owner's Clerk user id. `resolveTenant` (`src/db/team.ts`) maps a
  signed-in user to a workspace in three places:
  - the dashboard gate
  - the billing routes (owner-only, 403 for members)
  - OAuth start (a member connecting Google connects the shared workspace)
- **Membership only counts while the team's plan is `team`.** If it
  lapses, members fall back to their own personal workspace, which was
  never touched, and return automatically on renewal.
- **Joining:**
  - Blocked while the joiner has their own paid plan, so nobody pays
    twice. Blocked if they're already on a team.
  - The invite link must be opened by the invited email address, so a
    forwarded or leaked link doesn't hand out a seat.
  - Pending invites (7-day TTL, `TEAM_INVITE_TTL_DAYS`) hold a seat.
  - Tokens are stored only as a sha256 hash.
  - Accepting claims the invite with a conditional `UPDATE` before
    inserting the membership, and undoes the claim if the insert fails.
- **API keys are per person.** Each person sees and revokes only their own.
  - A member's key resolves to the team workspace.
  - `/mcp` re-checks that the key's creator is still active on that team
    (403 otherwise).
  - Removing a member, or a member leaving, deletes their keys outright.
- **Owner-only:** billing, inviting and removing people. Everything else
  (websites, Google connections, usage) is shared.
- **Dashboard:** a Team section in Settings, an `/dashboard/invite/:token`
  accept page, and `notifyTeamInvite` for the invite email. If the email
  can't be sent, Settings shows the owner the link to pass on themselves.

**Not built**: transferring ownership, per-member usage breakdown, more
than one team per person, seat add-ons beyond 5.

## M22: Standard MCP sign-in (OAuth 2.1)

**Why**: hosted clients (Claude's custom connectors, and the directories we
want to list in) connect with the MCP authorization spec, not a pasted
header. Claude reserves the `Authorization` header for its own sign-in, so a
key-only server couldn't be added there at all.

**How**: `@cloudflare/workers-oauth-provider` makes the Worker its own OAuth
server (`src/auth/mcp-oauth.ts`), with state in the `OAUTH_KV` namespace.
- In cloud mode every request enters through the provider. It answers the
  discovery documents, `/oauth/token` and `/oauth/register` itself, returns
  the standard `401` challenge on `/mcp`, and hands everything else to the
  Hono app. Self-host mode skips it and keeps the shared bearer token.
- `/authorize` (`src/auth/authorize-routes.ts`) signs the user in with the
  same Clerk session as the dashboard, then shows a consent page built to the
  library's guidance: app name, publisher domain for metadata-document
  clients, where access goes, a warning for `localhost`, anti-framing and a
  one-time form handle. Grants are issued to the Clerk user id.
- `/mcp` gets the caller from the provider (`ctx.props`). An OAuth caller's
  workspace is resolved on every request (`resolveTenant`), so team changes
  apply at once; plan, rate limit and daily cap then work as before.
- API keys still work: `resolveExternalToken` accepts `vsm_` keys, so Claude
  Code with a header, scripts and CI are unaffected. An unknown key gets the
  sign-in challenge rather than a bare 401.
- Settings → Connected apps lists each grant with Disconnect
  (`revokeGrant`, scoped to the user).
- Connections last while used: each refresh extends them 30 days.

**Directory readiness**: every tool now carries MCP annotations (all
read-only, non-destructive, idempotent; open-world except the three that
read only our own data), and tool descriptions say what each returns
without naming the data supplier.

## Verification discipline

Same as self-host: typecheck + lint + unit tests (pure logic, tenant-
scoping helpers, quota math, webhook signature verification, rate-limit
buckets) after every milestone; `wrangler dev` re-run for real once outside
this sandbox (still blocked here, no egress to Cloudflare's API); each new
external integration (Clerk, Dodo, xmit.sh) has its unverified assumptions
called out explicitly in code comments and here, not silently assumed
correct.
