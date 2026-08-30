-- Tracks whether a raw signal has been through triage yet, and what it
-- resolved to (a new incident, an existing one it was merged into, or
-- null if the LLM filtered it out as a false positive / not aviation).
-- Needed for queue-delivery idempotency (a redelivered message shouldn't
-- re-triage a signal that already resolved) and for a debug backlog view.

ALTER TABLE raw_signals ADD COLUMN triaged_at TEXT;
ALTER TABLE raw_signals ADD COLUMN incident_id INTEGER REFERENCES incidents(id);

CREATE INDEX idx_raw_signals_untriaged ON raw_signals(triaged_at) WHERE triaged_at IS NULL;
