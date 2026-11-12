-- One row per person who has ever signed in to the hosted product, however
-- they arrived: Clerk's user.created webhook, an MCP client's OAuth consent
-- (/authorize), or the dashboard. Before this, a signup left no trace of
-- its own until something else happened (a website, a key, a welcome email
-- that only went out on a first dashboard visit), so someone who signed up
-- through an MCP client and never opened the dashboard was invisible.
--
-- No email or name here on purpose: those stay in Clerk, read on demand
-- (src/auth/clerk.ts's getTenantEmail), same as every other table.
CREATE TABLE signups (
  user_id            TEXT PRIMARY KEY,
  -- When the account was created: Clerk's own timestamp when the webhook
  -- reports it, otherwise when we first saw the user. ISO 8601, so the
  -- earliest report wins by plain string comparison.
  signed_up_at       TEXT NOT NULL,
  -- How we first heard of them: 'clerk_webhook' | 'mcp_authorize' | 'dashboard' | 'backfill'.
  first_seen_via     TEXT NOT NULL,
  -- The first MCP client they approved on /authorize, as that client named
  -- itself at registration (self-reported, so display-only).
  first_client_name  TEXT,
  first_client_at    TEXT
);

-- Everyone who already got a welcome email has an account; their welcome
-- time is the closest thing to a signup time we have for them.
INSERT OR IGNORE INTO signups (user_id, signed_up_at, first_seen_via)
SELECT tenant_id, replace(sent_at, ' ', 'T') || 'Z', 'backfill'
FROM tenant_notifications
WHERE notice_key = 'welcome';
