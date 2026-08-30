# planecrashes.today — v1 prototype

Cloudflare-native, no static build step. A Worker (Hono) serves pages by
reading D1 directly on every request; a Cron Trigger polls ingestion
sources on its own schedule. Publishing a new incident never requires a
redeploy.

## Why this shape

Static builds don't fit a site where content shows up unpredictably and
needs to be live within minutes — a rebuild-and-redeploy cycle is the wrong
tool. Cloudflare's current guidance is to use **Workers** (not Pages) for
new full-stack projects: one deployable gets you static-asset serving,
SSR, D1, cron triggers, and (later) Queues/Durable Objects/R2/Vectorize
without splitting the app across two products.

## What's here (v1)

- **`src/index.ts`** — Hono app: homepage, incident detail page, a debug
  view of raw ingestion, and the scheduled (cron) handler.
- **`src/gdelt.ts`** — polls GDELT's DOC 2.0 API filtered on the
  `AVIATION_INCIDENT` theme. Chosen first because it's free, unrestricted-use
  licensed, and updates every ~15 min — the cleanest source from the
  sourcing research to stand up first.
- **`src/db.ts`** — D1 query helpers.
- **`migrations/0001_init.sql`** — two tables:
  - `raw_signals` — one row per ingested article/source hit, deduped on URL.
    This is *signal*, not a citable incident.
  - `incidents` — the canonical, public-facing table. **Nothing promotes
    `raw_signals` into `incidents` yet** — that's the LLM triage/dedup step
    (confirm it's real, extract structured fields, classify a status tier)
    from the original architecture discussion. `incidents` currently has
    two hand-written sample rows so the homepage renders something.
- **`src/render.ts`** — HTML templates. Dark-default, a muted fixed color
  per status tier (no escalating/alarm treatment), monospace for hard data
  vs. plain sans for editorial text — following the design research.

## What's deliberately not here yet

- **Triage/dedup worker** that promotes `raw_signals` → `incidents` (needs
  an LLM call — natural next step).
- **Queues** — add once ingestion has a slow/retryable step (the triage
  call). Cron writes straight to D1 for now.
- **KV** — add for hot-path caching once there's real traffic.
- **R2** — add once ingesting the FAA rolling CSV (it deletes its own
  history after ~10 days, so we need to archive snapshots ourselves).
- **More sources** — NewsData.io, FAA prelim CSV, NTSB CAROL, Wikidata
  backfill, per the sourcing research. GDELT alone is enough to validate
  the pipeline shape first.

## Setup

```bash
npm install

# One-time: create the D1 database, then paste the returned database_id
# into wrangler.jsonc (replacing REPLACE_WITH_D1_DATABASE_ID)
npx wrangler d1 create planecrashes-today-db

# Apply the schema
npm run db:migrate:local     # for local dev
npm run db:migrate:remote    # once deploying for real

# Run locally
npm run dev
```

Local dev serves the homepage with the two sample incidents immediately.
`wrangler dev` doesn't fire cron triggers on its own — either run with
`npm run dev:cron`, or hit `POST /debug/ingest/gdelt` directly to trigger
a real GDELT pull, then check `GET /debug/signals` to see what landed in
`raw_signals`.

## Deploy

```bash
npm run deploy
```

This registers the cron trigger from `wrangler.jsonc` automatically —
ingestion starts running on Cloudflare's schedule the moment it's deployed,
independent of any future frontend redeploy.
