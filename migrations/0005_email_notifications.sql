-- Backs dedup for every M18 transactional-email notice — one-time notices
-- (welcome), period-scoped ones (quota warnings, whose key already encodes
-- the period so no time math is needed), and cooldown-based recurring ones
-- (the Google reconnect nudge) all share this table. See src/email/dedup.ts.
CREATE TABLE tenant_notifications (
  tenant_id TEXT NOT NULL,
  notice_key TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, notice_key)
);
