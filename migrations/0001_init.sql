-- Two-table shape matching the pipeline: raw ingestion signal vs. canonical
-- incident record. Nothing auto-promotes raw_signals -> incidents yet; that's
-- the LLM triage/dedup step (Phase 2, per the sourcing research: GDELT etc.
-- give you "something happened," not clean structured fields).

CREATE TABLE raw_signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source        TEXT NOT NULL,              -- e.g. 'gdelt', 'faa_prelim', 'newsdata'
  url           TEXT NOT NULL UNIQUE,        -- dedup key for repeated cron polls
  title         TEXT NOT NULL,
  domain        TEXT,
  source_country TEXT,
  language      TEXT,
  seen_at       TEXT NOT NULL,               -- when the source first reported it
  raw_json      TEXT,                        -- full source payload, for later triage
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_raw_signals_seen_at ON raw_signals(seen_at DESC);
CREATE INDEX idx_raw_signals_source ON raw_signals(source);

CREATE TABLE incidents (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  status            TEXT NOT NULL CHECK (status IN (
                        'unconfirmed',
                        'confirmed_no_fatalities',
                        'confirmed_fatalities',
                        'investigating'
                      )),
  title             TEXT NOT NULL,
  summary           TEXT,
  location           TEXT,
  country           TEXT,
  lat               REAL,
  lon               REAL,
  aircraft_type     TEXT,
  operator          TEXT,
  flight_number     TEXT,
  fatalities        INTEGER,
  injuries          INTEGER,
  occurred_at       TEXT,                    -- when the event happened, if known
  first_seen_at     TEXT NOT NULL,           -- when we first detected it (drives freshness)
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  sources           TEXT NOT NULL,           -- JSON array: [{"name","url","type"}]
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_incidents_occurred_at ON incidents(occurred_at DESC);
CREATE INDEX idx_incidents_status ON incidents(status);

-- Sample rows so the homepage renders something meaningful before the
-- triage worker exists. Replace/remove once real incidents flow through.
INSERT INTO incidents
  (status, title, summary, location, country, aircraft_type, operator,
   fatalities, injuries, occurred_at, first_seen_at, sources)
VALUES
  ('confirmed_fatalities',
   'Sample: cargo aircraft down shortly after departure',
   'Placeholder record for layout/testing. Replace once ingestion + triage are wired up.',
   'Example City', 'US', 'MD-11F', 'Example Cargo Co.',
   3, 0, '2026-08-20T14:10:00Z', '2026-08-20T14:22:00Z',
   '[{"name":"Sample source","url":"https://example.com","type":"news"}]'),
  ('unconfirmed',
   'Sample: reports of small aircraft down near regional airport',
   'Placeholder record — unconfirmed status shows the taxonomy before anything is verified.',
   'Example County', 'US', NULL, NULL,
   NULL, NULL, NULL, '2026-08-29T09:05:00Z',
   '[{"name":"Sample wire","url":"https://example.com","type":"news"}]');
