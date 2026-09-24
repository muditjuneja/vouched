# Deploying Vouched Cloud on Cloudflare

This is the runbook for the hosted product at vouchedhq.com. Following it top
to bottom takes a fresh Cloudflare account to a working deployment. Self-host
is simpler and lives in `docs/SELF_HOST.md`.

## 1. What runs where

| Thing | Name | Defined in |
|---|---|---|
| Worker | `vouched-hq` | `wrangler.jsonc` `name` |
| D1 database (binding `DB`) | `vouched-seo-mcp` | `wrangler.jsonc` `d1_databases` |
| R2 bucket (binding `DATASETS`) | `vouched-seo-mcp-datasets` | `wrangler.jsonc` `r2_buckets` |
| KV namespace (binding `CACHE`) | `vouched-seo-mcp-cache` | `wrangler.jsonc` `kv_namespaces` (by id) |
| KV namespace (binding `OAUTH_KV`) | `vouched-seo-mcp-oauth` | `wrangler.jsonc` `kv_namespaces` (by id): MCP sign-in clients, grants and hashed tokens |
| Rate limiters | `MCP_RATE_LIMIT_FREE`, `MCP_RATE_LIMIT_PAID` | `wrangler.jsonc` `ratelimits` (created on deploy, nothing to set up) |

The R2 bucket only holds `export_dataset` files, which the privacy policy
promises are deleted after 7 days: the lifecycle rule above does the
deleting, and `readDataset` refuses anything older in the meantime
(`DATASET_TTL_DAYS` in `src/resources/store.ts`). Don't skip the rule.

The Worker is called `vouched-hq`, but the MCP server name clients see and the
D1, R2 and KV resources all use `vouched-seo-mcp`. That's deliberate:
renaming the database or the bucket would mean moving data.

For a brand-new account, create the resources first and paste the new ids into
`wrangler.jsonc`:

```sh
npx wrangler d1 create vouched-seo-mcp
npx wrangler r2 bucket create vouched-seo-mcp-datasets
npx wrangler r2 bucket lifecycle add vouched-seo-mcp-datasets expire-exports-7d --expire-days 7
npx wrangler kv namespace create vouched-seo-mcp-cache
npx wrangler kv namespace create vouched-seo-mcp-oauth
```

## 2. CI/CD (Workers Builds)

Workers & Pages → Create → Import a repository → `muditjuneja/experiments`.

| Setting | Value | Why |
|---|---|---|
| Project name | `vouched-hq` | Must equal `name` in `wrangler.jsonc`, or the build fails. |
| Production branch (Advanced settings) | `main` | The GitHub repo's default branch is a different project. |
| Root directory | blank | The Worker lives at the repo root. |
| Build variable | `SKIP_DEPENDENCY_INSTALL` = `1` | Turns off the automatic `npm ci`, which fails on this lockfile (see below). |
| Build command | `npm install --no-audit --no-fund && npm run typecheck && npm run lint` | Installs dependencies, then stops a deploy with type or lint errors. |
| Deploy command | `npx wrangler deploy` | |
| Preview builds | Off | Previews use the same D1, KV and R2 as production, so a branch preview would touch live data. Turn back on once there's a staging database. |
| Protect with Cloudflare Access | Off | It would block the public site and MCP clients. |

Every push to `main` deploys. Node comes from `.nvmrc` (22), matching local
development.

**Why not the automatic `npm ci`:** `agents` pulls in `rolldown` as a peer
dependency, and npm leaves rolldown's platform-specific packages
(`@rolldown/binding-*`) out of `package-lock.json` every time it saves the file.
`npm ci` on the Linux build machine then refuses to install ("package.json and
package-lock.json are not in sync"). Editing the lockfile by hand doesn't last:
the next local `npm install` strips the entries again. `npm install` still uses
the locked versions but tolerates the gap.

## 3. Database migrations

Migrations are **not** run by CI. Apply them yourself, **before** the deploy
that needs them:

```sh
npx wrangler d1 migrations list vouched-seo-mcp --remote   # what's pending
npm run db:migrate:remote                                   # apply it
```

Only merge a migration once it's safe for the *currently deployed* code to run
against the new schema (add columns and tables; never drop or rename in the same
release that stops using them). Rolling back the Worker doesn't roll back the
database.

## 4. Secrets

Set every value as a **secret**, never a plain-text variable: `wrangler deploy`
deletes dashboard-set plain-text variables that aren't in `wrangler.jsonc`, but
leaves secrets alone. Either use the dashboard (Worker → Settings → Variables and
Secrets → type *Secret*) or:

```sh
npx wrangler secret put CLOUD_MODE --name vouched-hq
```

The Worker has to exist before you can add secrets to it, so do this right after
the first deploy. Until `CLOUD_MODE` and `CLERK_SECRET_KEY` are both set, the
Worker runs in self-host mode.

| Secret | Needed for | Where it comes from |
|---|---|---|
| `CLOUD_MODE` | Everything cloud: set to `1` | |
| `CLERK_SECRET_KEY` | Dashboard sign-in; cloud mode is off without it | Clerk → API Keys (`sk_live_...` in production) |
| `CLERK_PUBLISHABLE_KEY` | The post-sign-in handshake; without it `/dashboard` loops on 401 | Clerk → API Keys (`pk_live_...`) |
| `CLERK_JWT_KEY` | Faster session checks (recommended) | Clerk → API Keys → PEM public key. Not the publishable key. |
| `CLERK_SIGN_IN_URL` | Where signed-out visitors go | Your Clerk sign-in page, e.g. `https://accounts.vouchedhq.com/sign-in` |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | Search Console and GA4 tools | Google Cloud → Credentials (section 6) |
| `CLOUD_DATAFORSEO_LOGIN`, `CLOUD_DATAFORSEO_PASSWORD` | Paid market-data tools on Pro/Team | Our DataForSEO account |
| `DATAFORSEO_DAILY_BUDGET_USD` | Optional daily spend warning | Pick a number |
| `DODO_API_KEY`, `DODO_WEBHOOK_SECRET` | Billing | Dodo → Developer (section 6) |
| `DODO_ENVIRONMENT` | `live_mode` to take real money; defaults to `test_mode` | |
| `DODO_PRODUCT_ID_PRO`, `DODO_PRODUCT_ID_TEAM` | Subscriptions | Dodo → Products |
| `DODO_PRODUCT_ID_WALLET_TOPUP` | Wallet top-ups | A Dodo **Single Payment** product with *Pay what you want* on |
| `XMIT_API_KEY`, `XMIT_FROM_EMAIL` | Transactional email, e.g. `hello@vouchedhq.com` | xmit.sh |
| `XMIT_BCC_EMAIL` | Optional: an operator inbox that gets a blind copy of every email | Your address |
| `ADMIN_ALERT_WEBHOOK_URL` | Optional Slack/Discord alerts for billing failures and budget warnings | Slack or Discord incoming webhook |
| `PAGESPEED_API_KEY` | Not needed: `audit_site` is hidden for now | |

`MCP_BEARER_TOKEN` is only for self-host. In cloud mode each user authenticates
with their own API key from the dashboard.

## 5. Custom domain

Worker → Settings → Domains & Routes → Add → Custom domain → `vouchedhq.com`.
The zone has to be in the same Cloudflare account. Cloudflare creates the DNS
record and certificate itself.

It isn't in `wrangler.jsonc` on purpose: anyone self-hosting from this repo
would fail to deploy with a domain they don't own.

## 6. Outside Cloudflare

Every URL here uses the production domain. The app builds its own links from
the domain each request arrives on, and email links use
`SITE_URL` (`src/lib/product.ts`).

**Clerk**
- Create a production instance for `vouchedhq.com` and add the DNS records it
  asks for.
- Copy its production keys into the secrets above.

**Google Cloud** (one OAuth client)
- Authorized redirect URI: `https://vouchedhq.com/oauth/google/callback`.
- OAuth consent screen: add `vouchedhq.com` as an authorized domain, then
  publish the app.
- Enable the Search Console API, Google Analytics Data API and Google Analytics
  Admin API.
- The app asks for `webmasters.readonly` and `analytics.readonly`, which Google
  treats as sensitive scopes. Until Google verifies the app, users see an
  "unverified app" warning and there's a 100-user cap. Start verification early:
  it takes weeks.

**Dodo Payments**
- Webhook endpoint: `https://vouchedhq.com/webhooks/dodo`. Subscribe to every
  `subscription.*` event plus `payment.succeeded`, which credits wallet
  top-ups. Copy the signing secret into `DODO_WEBHOOK_SECRET`.
- Products: Pro and Team as subscriptions; the wallet top-up as a Single Payment
  product with *Pay what you want* enabled (the toggle only appears for that
  pricing type).
- Test and live mode have separate keys, products and webhooks. Switching to live
  means redoing all three and setting `DODO_ENVIRONMENT=live_mode`.

**xmit.sh**
- Verify `vouchedhq.com` as a sending domain (SPF/DKIM records), then set
  `XMIT_FROM_EMAIL`.

## 6b. MCP sign-in (OAuth)

Nothing to configure beyond the `OAUTH_KV` binding: the Worker is its own
OAuth server (`src/auth/mcp-oauth.ts`) and signs people in with Clerk. What
clients discover, all on the production domain:

- `/.well-known/oauth-protected-resource/mcp` and
  `/.well-known/oauth-authorization-server`: discovery documents.
- `/authorize` (Clerk sign-in, then our consent page), `/oauth/token`,
  `/oauth/register` (dynamic client registration). Client ID Metadata
  Documents are on too, which needs the `global_fetch_strictly_public`
  compatibility flag already in `wrangler.jsonc`.

Clerk's sign-in must be able to return to `/authorize` on this domain: for a
development Clerk app, set its development origin to the site (see the
Clerk step above).

## 7. Check it works

After the first deploy with secrets in place:

1. `curl https://vouchedhq.com/health` returns `vouched-seo-mcp: ok`.
2. `https://vouchedhq.com/` loads the landing page.
3. `/dashboard` sends you to Clerk, and signing in lands back on the dashboard,
   not a 401 loop.
4. Websites → Add website → Connect Google, and Search Console properties show
   up.
5. API keys → New key, then connect a client:
   ```sh
   claude mcp add --transport http vouched-seo-mcp https://vouchedhq.com/mcp \
     --header "Authorization: Bearer <key>"
   ```
   and call `list_websites`.
6. In Dodo test mode: upgrade to Pro, and within a minute the Billing page shows
   Pro (proves the webhook works). Then try a wallet top-up.
7. With email set up: you get the welcome email, and its link opens
   `vouchedhq.com`.

Logs: Worker → Logs, or `npx wrangler tail vouched-hq`.

## 8. Rolling back

Worker → Deployments → pick an earlier version → Rollback, or
`npx wrangler rollback`. This rolls back code only: database migrations stay
applied (see section 3), and the next push to `main` deploys again.
