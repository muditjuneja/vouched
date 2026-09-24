-- Team seats. A workspace's tenant_id stays the owner's Clerk user id, the
-- same key every other table already uses, so existing single-user
-- tenants need no data migration at all. The owner is implicit (the user
-- whose id equals tenant_id) and never has a row here; only invited
-- members do. A user belongs to at most one team at a time (user_id is
-- the primary key); their own personal workspace keeps existing untouched
-- while they're a member.
CREATE TABLE tenant_members (
  user_id     TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tenant_members_tenant ON tenant_members (tenant_id);

-- Pending/accepted invites. Only the token's hash is stored, same as
-- mcp_api_keys: the plaintext only ever exists in the invite email.
-- Pending (unaccepted, unexpired) invites count against the seat limit,
-- so an owner can't over-invite past it.
CREATE TABLE tenant_invites (
  invite_id    TEXT PRIMARY KEY,
  token_hash   TEXT NOT NULL UNIQUE,
  tenant_id    TEXT NOT NULL,
  email        TEXT NOT NULL,
  invited_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT NOT NULL,
  accepted_at  TEXT,
  accepted_by  TEXT
);
CREATE INDEX idx_tenant_invites_tenant ON tenant_invites (tenant_id);

-- Which user created an MCP API key. Members create keys under the team's
-- tenant_id, so without this, a removed member's keys would keep working.
-- NULL on keys created before seats existed: those belong to the owner.
ALTER TABLE mcp_api_keys ADD COLUMN created_by TEXT;
