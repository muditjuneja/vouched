-- The per-minute /mcp limit moved to Cloudflare's native Rate Limiting
-- binding (wrangler.jsonc "ratelimits"), so the D1 bucket table from
-- 0004_hardening.sql is no longer read or written. Its rows were only
-- ever minute-long counters, nothing worth keeping.
DROP TABLE IF EXISTS rate_limit_buckets;

-- Free-tier daily tool-call cap (src/db/daily-tool-calls.ts). Lives in D1,
-- not the native binding or KV: a daily cap has to be exact, the binding's
-- longest window is 60s, and KV has no atomic increment. One row per
-- tenant per UTC day; small enough (about 365 rows per free tenant per
-- year) not to need pruning yet.
CREATE TABLE daily_tool_calls (
  tenant_id  TEXT NOT NULL,
  day        TEXT NOT NULL, -- UTC "YYYY-MM-DD"
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, day)
);
