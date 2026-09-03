-- Fixes the known limitation documented in migrations/0002_multi_tenant.sql:
-- `websites.primary_domain` carried a global UNIQUE constraint from
-- migration 0001, predating multi-tenancy, so two different cloud tenants
-- could never both track the same domain. SQLite/D1 can't ALTER a column
-- constraint in place, so this rebuilds the table without it.
--
-- Uses two PARTIAL unique indexes rather than one compound
-- UNIQUE(tenant_id, primary_domain), deliberately: SQLite treats every
-- NULL as distinct from every other NULL in a unique index, so a plain
-- compound constraint would silently stop deduplicating self-host's
-- domains (tenant_id always NULL) the moment this shipped. The two
-- indexes below instead preserve self-host's original guarantee exactly
-- (one row per domain when tenant_id IS NULL) while unblocking cloud
-- tenants from each other (one row per domain per tenant_id when it's
-- NOT NULL). No application code changes needed — src/db/websites.ts's
-- existing `IS`-based queries and insert-then-read-back pattern are
-- already correct against this shape; only the constraint moves.
--
-- Partial indexes are standard SQLite and expected to work on D1, but —
-- like every schema change in this build — unverified against a real D1
-- instance in this sandbox (`wrangler d1 execute` has no egress here).
CREATE TABLE websites_new (
  website_id      TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  primary_domain  TEXT NOT NULL,
  is_default      INTEGER NOT NULL DEFAULT 0,
  gsc_site_url    TEXT,
  ga4_property_id TEXT,
  tenant_id       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO websites_new (website_id, name, primary_domain, is_default, gsc_site_url, ga4_property_id, tenant_id, created_at)
SELECT website_id, name, primary_domain, is_default, gsc_site_url, ga4_property_id, tenant_id, created_at FROM websites;

DROP TABLE websites;
ALTER TABLE websites_new RENAME TO websites;

CREATE UNIQUE INDEX idx_websites_domain_self_host ON websites (primary_domain) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX idx_websites_tenant_domain ON websites (tenant_id, primary_domain) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_websites_tenant ON websites (tenant_id);
