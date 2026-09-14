-- Prepaid overage wallet. Once a tenant is past their plan's bundled
-- DataForSEO quota (src/billing/quotas.ts's MONTHLY_QUOTA_USD), a call is
-- allowed to continue (instead of being blocked with QuotaExceededError)
-- only if this balance is positive, and is debited afterward at cost
-- times OVERAGE_MARKUP_MULTIPLIER. Balance is never spent before it's
-- paid for, so unlike postpaid metered billing there's no collections
-- risk on our side. Funded via a one-time Dodo payment
-- (src/billing/dodo-client.ts's startWalletTopup), never a subscription;
-- works independently of plan, so even a free-plan tenant can pay
-- straight from their wallet with no subscription at all.
--
-- Dodo Payments also has its own native subscription-attached credit
-- system (credit.added/credit.deducted/CreditBalanceLow/
-- CreditOverageCharged events, tied to a per-product "credit
-- entitlement" configured in the Dodo dashboard) that could replace this
-- table entirely. Not adopted here: it needs product-level credit
-- entitlement configuration this sandbox has no live account to verify,
-- and the per-call quota check below needs a synchronous, cheap local
-- lookup regardless of who the system of record is, worth revisiting
-- against a real Dodo account before launch.
ALTER TABLE subscriptions ADD COLUMN wallet_balance_usd REAL NOT NULL DEFAULT 0;

-- Append-only audit trail behind wallet_balance_usd: one row per top-up
-- (positive delta_usd, tagged with the Dodo payment_id that funded it)
-- and one row per overage debit (negative delta_usd, tagged with the
-- billing period it happened in). subscriptions.wallet_balance_usd is
-- the fast-path number every quota check reads; this table exists so
-- that number is reconcilable rather than an opaque running total, and
-- so a retried Dodo webhook delivery can never double-credit a top-up
-- (the unique index below makes a second insert for the same
-- dodo_payment_id a no-op).
CREATE TABLE wallet_ledger (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       TEXT NOT NULL,
  delta_usd       REAL NOT NULL,
  reason          TEXT NOT NULL CHECK (reason IN ('topup', 'overage_usage')),
  dodo_payment_id TEXT,
  period          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_wallet_ledger_dodo_payment ON wallet_ledger (dodo_payment_id) WHERE dodo_payment_id IS NOT NULL;
CREATE INDEX idx_wallet_ledger_tenant ON wallet_ledger (tenant_id);
