-- Multi-tenancy: every table gets a nullable tenant_id. NULL means
-- "self-host, single-user" — the M0-M9 behavior, completely unaffected.
-- Cloud mode (M12+) sets tenant_id to the Clerk user id on every row it
-- writes, and every query helper filters by it. `IS` (not `=`) is used in
-- WHERE clauses throughout so a NULL tenant_id still matches correctly —
-- `= NULL` is never true in SQL.

-- KNOWN LIMITATION (not fixed here): `websites.primary_domain` carries a
-- global UNIQUE constraint from migration 0001, predating multi-tenancy.
-- SQLite/D1 can't ALTER a column constraint in place, only via a
-- create-new-table-and-copy rebuild — risky to do unverified in this
-- sandbox (no working `wrangler d1 execute` here, see README). Practical
-- effect: two different cloud tenants cannot both track the exact same
-- domain. Fix in a follow-up migration: rebuild the table with
-- UNIQUE(tenant_id, primary_domain) instead, tested against a real D1
-- instance first.
ALTER TABLE websites ADD COLUMN tenant_id TEXT;
ALTER TABLE google_tokens ADD COLUMN tenant_id TEXT;
ALTER TABLE cost_log ADD COLUMN tenant_id TEXT;
ALTER TABLE observations ADD COLUMN tenant_id TEXT;

CREATE INDEX idx_websites_tenant ON websites (tenant_id);
CREATE INDEX idx_google_tokens_tenant ON google_tokens (tenant_id);
CREATE INDEX idx_cost_log_tenant ON cost_log (tenant_id);

-- One row per cloud tenant with an active or past Dodo subscription.
-- Absent entirely for self-host users (there is no "tenant").
CREATE TABLE subscriptions (
  tenant_id           TEXT PRIMARY KEY,
  dodo_customer_id    TEXT,
  dodo_subscription_id TEXT,
  plan                TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'team')),
  status              TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'expired')),
  current_period_end  TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-tenant, per-billing-period usage against their plan's bundled
-- DataForSEO quota (M14 reads/writes this; the plain cost_log table above
-- remains the detailed per-call log, this is the fast aggregate for
-- quota-check-on-every-call).
CREATE TABLE usage_counters (
  tenant_id       TEXT NOT NULL,
  period          TEXT NOT NULL, -- "YYYY-MM", resets monthly
  calls_used      INTEGER NOT NULL DEFAULT 0,
  cost_incurred_usd REAL NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, period)
);
