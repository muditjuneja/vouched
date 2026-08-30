# planecrashes.today — prototype

Cloudflare-native, no static build step. A Worker (Hono) serves pages by
reading D1 directly on every request; a Cron Trigger polls ingestion
sources on its own schedule, feeding a Queue that runs each signal through
an LLM triage step (via OpenRouter) before it becomes a public incident.
Publishing a new incident never requires a redeploy.

## Pipeline shape

```
Cron Trigger (2 schedules: */15min fast sources, hourly slow sources)
  -> fetch each source (GDELT, NewsData.io / NTSB CAROL, FAA prelim)
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
- **`src/sources/ntsb.ts`** — real implementation, ported from a working
  reference (Amineharrabi/NTSB_api's server source, read directly rather
  than guessed) since `data.ntsb.gov` itself was unreachable from this
  sandbox to verify independently. POSTs the CAROL "FileExport" query
  (exact `QueryGroups`/`QueryRules` payload shape copied from that repo),
  unzips the response with `fflate` (the API returns a ZIP containing one
  JSON file, not plain JSON), and maps fields confirmed against a real
  saved sample case record from that repo. No confirmed public deep-link
  URL exists for an individual case (only found a pattern for safety-rec
  pages, not accident cases) — the source link points at the official
  CAROL search UI with the case number as a query param, not a verified
  working permalink; said plainly in the file.
- **`src/sources/faa.ts`** — real implementation. The "no stable URL"
  assessment from the first pass was wrong about this *specific* link: the
  Oracle APEX "Excel output" URL is a fixed report ID, not session-bound,
  and a community GitHub Action has been pulling it weekly since Aug 2021
  without it breaking. Column layout copied verbatim from that repo's
  merged CSV header. Ships a small hand-rolled RFC4180 CSV parser (quoted
  fields, embedded commas, `""` escapes) rather than a dependency, since
  the shape is simple and stable. No per-record FAA URL exists (it's a
  flat export, not a database with permalinks) — the source link points
  at FAA's real published-data page with a fragment built from
  distinguishing fields for our own dedup uniqueness, not a working
  deep link to that specific record; said plainly in the file.
- **`scripts/test-source-parsers.ts`** — verifies both against the *real*
  captured sample data above (not synthetic fixtures) through a mocked
  `fetch()`, since neither `data.ntsb.gov` nor `asias.faa.gov` are
  reachable from this dev sandbox to test live. Run with
  `node --experimental-strip-types scripts/test-source-parsers.ts`.
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
  of D1. Matters most for FAA's rolling window, which deletes its own
  history — our R2 copy is the only durable record of what it said.
- **`src/render.ts`** — dark-default HTML, a muted fixed color per status
  tier (no escalating/alarm treatment), monospace for hard data vs. plain
  sans for editorial text — following the design research from this
  project's planning conversation.
- **`migrations/`** — `raw_signals` (dedup log) + `incidents` (canonical,
  public) + triage-tracking columns.

## What's still deliberately not here

- Multi-language triage (NewsData.io is English-only for now; widen once
  the triage prompt is validated on English signals).
- A confirmed NTSB per-case deep link, and any per-record FAA link (neither
  source publishes one — see the in-file notes in `src/sources/ntsb.ts` and
  `faa.ts`). Both currently link to the right official search/data page
  rather than a specific record.
- Validation that the NTSB `SessionId: 227230` value in the FileExport
  payload (copied from the reference implementation) doesn't need to be a
  live/rotating session — untested against the real endpoint from this
  sandbox; worth confirming on first real deploy.
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
network egress to actually reach GDELT/NewsData.io/NTSB/FAA/OpenRouter,
which this development sandbox's own network policy blocks entirely
(confirmed while building this — every external source returns a 403 from
the sandbox's own proxy, not from the real service; see each source file's
comments and `scripts/test-source-parsers.ts` for how the parsing/mapping
logic itself was verified without live access).

`wrangler dev` doesn't fire cron on its own — either run `wrangler dev
--test-scheduled`, or use the debug routes:

- `POST /debug/ingest/gdelt` / `newsdata` / `ntsb` / `faa` — run one
  ingestion pass for that source. `ntsb` takes optional `?start=&end=`
  (YYYY-MM-DD, defaults to the last 7 days).
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
