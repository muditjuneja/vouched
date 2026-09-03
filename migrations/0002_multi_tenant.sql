-- Multi-tenancy: every table gets a nullable tenant_id. NULL means
-- "self-host, single-user" — the M0-M9 behavior, completely unaffected.
-- Cloud mode (M12+) sets tenant_id to the Clerk user id on every row it
-- writes, and every query helper filters by it. `IS` (not `=`) is used in
-- WHERE clauses throughout so a NULL tenant_id still matches correctly —
-- `= NULL` is never true in SQL.

-- `websites.primary_domain` carries a global UNIQUE constraint from
-- migration 0001, predating multi-tenancy — two different cloud tenants
-- couldn't both track the exact same domain. Fixed in
-- migrations/0006_website_domain_uniqueness.sql (a table rebuild, since
-- SQLite/D1 can't ALTER a column constraint in place).
ALTER TABLE websites ADD COLUMN tenant_id TEXT;
ALTER TABLE google_tokens ADD COLUMN tenant_id TEXT;
ALTER TABLE cost_log ADD COLUMN tenant_id TEXT;
ALTER TABLE observations ADD COLUMN tenant_id TEXT;

CREATE INDEX idx_websites_tenant ON websites (tenant_id);
CREATE INDEX idx_google_tokens_tenant ON google_tokens (tenant_id);
CREATE INDEX idx_cost_log_tenant ON cost_log (tenant_id);

-- One row per cloud tenant with an active or past Dodo subscription.
-- Absent entirely for self-host users (there is no "tenant"). `status`
-- uses Dodo's own real subscription status vocabulary verbatim (confirmed
-- against @dodopayments/core's actual schema types in M13, not guessed —
-- this table was M11-authored before that verification and originally had
-- a wrong/invented status list; fixed in place here rather than via a
-- later migration since M11's shape has never been applied to a real D1).
CREATE TABLE subscriptions (
  tenant_id           TEXT PRIMARY KEY,
  dodo_customer_id    TEXT,
  dodo_subscription_id TEXT,
  plan                TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'team')),
  status              TEXT NOT NULL CHECK (status IN ('pending', 'active', 'on_hold', 'paused', 'cancelled', 'failed', 'expired')),
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
