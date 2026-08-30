# planecrashes.today — prototype

Cloudflare-native, no static build step. A Worker (Hono) serves pages by
reading D1 directly on every request; a Cron Trigger polls ingestion
sources on its own schedule, feeding a Queue that runs each signal through
an LLM triage step (via OpenRouter) before it becomes a public incident.
Publishing a new incident never requires a redeploy.

## Pipeline shape

```
Cron Trigger (every 15min)
  -> fetch each source (GDELT, NewsData.io)
  -> archive raw payload to R2
  -> upsert into D1 raw_signals (deduped on URL)
  -> enqueue newly-inserted ids to INGEST_QUEUE
                                        |
                                        v
                              Queue consumer (this Worker)
                                        |
                    fetch signal + recent open incidents from D1
                                        |
                         OpenRouter LLM triage call
                        (real event? dedup match? extract fields?)
                                        |
              +-------------------------+-------------------------+
              v                         v                         v
        false positive          matches existing            new incident
        -> mark triaged,        -> append source,            -> insert row,
           no incident             bump updated_at              mark triaged
                                        |
                                        v
                            purge homepage KV cache
```

`GET /` reads D1 through a 60s KV cache. `wrangler.jsonc` registers the cron
trigger and queue at deploy time — nothing here depends on a frontend
rebuild.

## Why this shape (recap)

Static builds don't fit a site where content shows up unpredictably and
needs to be live within minutes. Cloudflare's current guidance is to use
**Workers** (not Pages) for new full-stack projects — one deployable gets
static-asset serving, SSR, D1, Queues, KV, R2, and Cron Triggers together.

## What's here

- **`src/index.ts`** — Hono app: homepage (KV-cached), incident detail,
  debug routes, the `scheduled()` cron handler, and the `queue()` consumer.
- **`src/sources/gdelt.ts`** — GDELT DOC 2.0 API, `AVIATION_INCIDENT` theme.
  Free, unrestricted-use licensed, ~15min freshness. The core breaking
  signal.
- **`src/sources/newsdata.ts`** — NewsData.io, a hyperlocal complement to
  GDELT (95K+ sources, 206 countries), built for structured querying —
  matches the facts+metadata+link-back model. Requires `NEWSDATA_API_KEY`;
  skipped gracefully (not a hard failure) if unset.
- **`src/sources/wikidata.ts`** — Wikidata SPARQL backfill for the
  historical archive (CC0, zero licensing risk). Triggered manually via
  `POST /admin/backfill/wikidata`, not on the cron — Wikidata lags real
  events by days-to-weeks, it's for history, not breaking signal.
- **`src/sources/ntsb.ts`, `src/sources/faa.ts`** — **stubs, not
  implemented.** Both explain exactly why in-file: NTSB's CAROL search API
  uses a filter DSL this session couldn't verify against the live docs
  (network egress in this sandbox blocked `data.ntsb.gov`); FAA's
  preliminary data is served through an Oracle APEX interactive report with
  no stable export URL to hardcode. Shipping a guessed implementation
  against either would silently break rather than help — see the in-file
  comments for the concrete next step (a reference implementation to port
  from, in both cases) before building these for real.
- **`src/llm.ts`** — OpenRouter client for the triage call
  (`response_format: json_object`, temperature 0). Model is
  `OPENROUTER_MODEL` in `wrangler.jsonc` vars, not hardcoded — check
  [openrouter.ai/models](https://openrouter.ai/models) before trusting the
  committed default, model catalogs move.
- **`src/triage.ts` / `applyTriageResult` in `src/db.ts`** — the actual
  triage decision: filter out false positives, merge into an existing open
  incident (dedup), or create a new one. Idempotent on `raw_signals.triaged_at`
  so a redelivered queue message is a no-op.
- **`src/archive.ts`** — writes every raw source payload to R2, independent
  of D1. Cheap insurance, matters most for self-deleting sources like FAA's
  rolling CSV once that's implemented.
- **`src/render.ts`** — dark-default HTML, a muted fixed color per status
  tier (no escalating/alarm treatment), monospace for hard data vs. plain
  sans for editorial text — following the design research from this
  project's planning conversation.
- **`migrations/`** — `raw_signals` (dedup log) + `incidents` (canonical,
  public) + triage-tracking columns.

## What's still deliberately not here

- NTSB CAROL and FAA prelim ingestion (see above — stubbed with a documented
  path in, not silently missing).
- Multi-language triage (NewsData.io is English-only for now; widen once
  the triage prompt is validated on English signals).
- Any UI for the archive/history section, or auth-gating the `/debug/*` and
  `/admin/*` routes (fine for a prototype, not for a public deploy).
- Batch-triage for the Wikidata backfill (it lands in `raw_signals` but
  isn't auto-enqueued — one-by-one LLM triage of hundreds of historical
  rows would be wasteful; batch or direct-map once the field mapping is
  validated against real output).

## Setup

```bash
npm install

# D1 — system of record
npx wrangler d1 create planecrashes-today-db
# paste the returned database_id into wrangler.jsonc

# KV — homepage read cache
npx wrangler kv namespace create CACHE
# paste the returned id into wrangler.jsonc

# R2 — raw payload archive
npx wrangler r2 bucket create planecrashes-today-archive

# Queue — decouples ingestion from LLM triage
npx wrangler queues create planecrashes-today-ingest

# Secrets
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put NEWSDATA_API_KEY   # optional — that source no-ops without it

# Schema
npm run db:migrate:local     # local dev
npm run db:migrate:remote    # once deploying for real

npm run dev
```

For local dev, put `OPENROUTER_API_KEY=...` (and `NEWSDATA_API_KEY=...` if
testing that source) in a `.dev.vars` file (gitignored) — `wrangler dev`
reads it automatically. `wrangler dev` simulates D1/KV/R2/Queues locally,
no live Cloudflare account needed to exercise the wiring; it does need real
network egress to actually reach GDELT/NewsData.io/OpenRouter, which this
development sandbox's own network policy blocks (confirmed while building
this — `GDELT request failed: 403`, `Host not in allowlist: openrouter.ai`
— both are this sandbox, not the code; verified the D1/KV/R2/Queue wiring
itself works by seeding a `raw_signals` row directly and confirming triage
gets all the way to the OpenRouter call before failing on the network
policy).

`wrangler dev` doesn't fire cron on its own — either run `wrangler dev
--test-scheduled`, or use the debug routes:

- `POST /debug/ingest/gdelt` / `POST /debug/ingest/newsdata` — run one
  ingestion pass.
- `GET /debug/signals` — see what landed in `raw_signals` and whether it's
  been triaged.
- `POST /debug/triage/:rawSignalId` — manually run triage on one signal.
- `POST /admin/backfill/wikidata` — pull the Wikidata historical set into
  `raw_signals`.

## Visually verifying the UI

`scripts/screenshot.mjs` drives the real running `wrangler dev` server with
Playwright and saves full-page screenshots — this is how the UI actually
got checked while building it (caught a real mobile nav-wrap bug this way,
not just eyeballing code). Requires `wrangler dev` running on :8787:

```bash
npm run dev &
node scripts/screenshot.mjs /tmp/screenshots
```

Uses the Chromium Playwright manages for you (`npx playwright install` if
you don't have one already — this repo doesn't vendor a browser binary).

## Deploy

```bash
npm run deploy
```

Registers the cron trigger and queue consumer automatically — ingestion and
triage start running on Cloudflare's schedule the moment it's deployed,
independent of any future frontend redeploy.
