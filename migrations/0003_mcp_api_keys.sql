-- Per-tenant long-lived keys for authenticating the /mcp endpoint in cloud
-- mode — distinct from a Clerk session (which authenticates the dashboard,
-- expires, and isn't meant for static client config like `claude mcp add
-- --header`). Only the SHA-256 hash is ever stored; the plaintext key is
-- shown to the tenant exactly once, at creation time.
CREATE TABLE mcp_api_keys (
  key_id        TEXT PRIMARY KEY,
  key_hash      TEXT NOT NULL UNIQUE,
  tenant_id     TEXT NOT NULL,
  label         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at  TEXT
);
CREATE INDEX idx_mcp_api_keys_tenant ON mcp_api_keys (tenant_id);
