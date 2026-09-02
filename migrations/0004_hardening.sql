-- Per-tenant request rate limiting for the /mcp endpoint (cloud mode only
-- — self-host is single-user, no need). A D1-backed fixed-window counter
-- rather than Cloudflare's native Rate Limiting binding: the binding is
-- more scalable but needs a wrangler.jsonc `unsafe.bindings` entry this
-- sandbox has no way to verify — documented as a future upgrade in
-- docs/ARCHITECTURE.md instead of built unverified.
CREATE TABLE rate_limit_buckets (
  tenant_id  TEXT NOT NULL,
  bucket     TEXT NOT NULL, -- current UTC minute, "YYYY-MM-DDTHH:MM"
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, bucket)
);
-- No index needed beyond the primary key — every query is a point lookup
-- by (tenant_id, bucket). Old buckets accumulate; pruning rows older than
-- a day or two is a fast-follow (a Cron Trigger, once one exists for any
-- reason — see docs/ARCHITECTURE.md's future-upgrades list).
