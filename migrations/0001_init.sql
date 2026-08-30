-- Source of truth for tracked/owned sites. Backs core.list_websites and
-- resolves site identity for the gsc/analytics/audit domains.
CREATE TABLE websites (
  website_id      TEXT PRIMARY KEY,      -- uuid, generated at insert time
  name            TEXT NOT NULL,
  primary_domain  TEXT NOT NULL UNIQUE,
  is_default      INTEGER NOT NULL DEFAULT 0,  -- 0/1
  gsc_site_url    TEXT,                  -- e.g. "sc-domain:example.com"
  ga4_property_id TEXT,                  -- e.g. "properties/123456789"
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Google OAuth tokens, keyed by the connected account's email plus which
-- scope group it authorizes. One row can cover multiple websites (a single
-- Google account often owns several properties); resolution happens by
-- checking scope + expiry against what a tool call needs.
CREATE TABLE google_tokens (
  account_email  TEXT NOT NULL,
  scope_group    TEXT NOT NULL CHECK (scope_group IN ('webmaster_console', 'analytics_property')),
  access_token   TEXT NOT NULL,
  refresh_token  TEXT NOT NULL,
  expires_at     TEXT NOT NULL,           -- ISO 8601
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (account_email, scope_group)
);

-- Per-call DataForSEO cost log — backs the transparent pass-through-cost
-- promise (vs. OpenRush's opaque "credits") and the daily budget warning.
CREATE TABLE cost_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name     TEXT NOT NULL,
  endpoint      TEXT NOT NULL,
  cost_usd      REAL NOT NULL,
  called_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_cost_log_called_at ON cost_log (called_at);

-- Prior-observation snapshots, keyed by tool + subject + normalized params.
-- Lets a tool compute a real `deltas` field against the last time the same
-- question was asked, instead of shipping deltas as a permanent stub.
CREATE TABLE observations (
  tool_name     TEXT NOT NULL,
  subject_key   TEXT NOT NULL,   -- e.g. "domain:example.com" or a params hash
  facts_json    TEXT NOT NULL,   -- compact snapshot of the facts that matter for diffing
  observed_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tool_name, subject_key)
);
