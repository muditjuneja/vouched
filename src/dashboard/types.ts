import type { ConnectionState } from "../auth/google-oauth";
import type { CostLogRow } from "../clients/dataforseo/cost-tracker";
import type { GA4Property } from "../clients/google/analytics-ga4";
import type { SearchConsoleSite } from "../clients/google/search-console";
import type { McpApiKeyRow } from "../db/mcp-api-keys";
import type { Plan, SubscriptionStatus, WalletLedgerRow } from "../db/subscriptions";
import type { WebsiteRow } from "../db/websites";

export interface DashboardWebsite {
  row: WebsiteRow;
  gsc: ConnectionState | "not_configured";
  ga4: ConnectionState | "not_configured";
}

/**
 * Each page fetches only the data it actually renders (a separate props
 * type per page below) rather than one shared "whole dashboard" blob,
 * the old single-page dashboard could get away with one fetch since
 * everything rendered on the same response; five separate pages
 * shouldn't all pay for wallet-ledger/cost-log queries they don't show.
 */
export interface OverviewData {
  plan: Plan;
  status: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  usageUsd: number;
  quotaUsd: number;
  walletBalanceUsd: number;
  websiteCount: number;
  recentActivity: CostLogRow[];
  dodoConfigured: boolean;
  hasDodoCustomer: boolean;
}

export interface WebsitesData {
  websites: DashboardWebsite[];
  googleOAuthConfigured: boolean;
  /**
   * The tenant's scope-wide Google connection state, so the "Add a
   * website" widget can offer a direct Connect action right here instead
   * of sending the tenant to Settings first (that used to be the only
   * place to connect).
   */
  gscState: ConnectionState;
  ga4State: ConnectionState;
  /**
   * The tenant's real GSC sites / GA4 properties, fetched live from Google
   * once per page load when that scope is connected: lets the add/edit
   * forms offer a real picker instead of a raw text field the tenant has
   * to hand-type an internal id into. `null` means "don't show a picker"
   * (not connected, or the listing call itself failed): the form falls
   * back to a plain text input either way, never a dead end.
   */
  gscSites: SearchConsoleSite[] | null;
  ga4Properties: GA4Property[] | null;
  /** Set right after the OAuth callback redirects back here (see src/auth/oauth-routes.ts's handleOAuthCallback), so a connect started from this page lands on a real confirmation right here instead of over on Settings. */
  justConnected: "webmaster_console" | "analytics_property" | null;
}

export interface UsageData {
  rows: CostLogRow[];
  nextBeforeId: number | null;
}

export interface BillingData {
  plan: Plan;
  status: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  usageUsd: number;
  quotaUsd: number;
  walletBalanceUsd: number;
  walletLedger: WalletLedgerRow[];
  dodoConfigured: boolean;
  hasDodoCustomer: boolean;
  checkoutSuccess: boolean;
  topupSuccess: boolean;
  /** Prefills the upgrade/top-up forms' email field so an already-signed-in tenant never retypes it; null falls back to a visible input. */
  prefillEmail: string | null;
}

export interface SettingsData {
  email: string | null;
  apiKeys: McpApiKeyRow[];
  /** Tenant-wide connection state, unlike WebsitesData's per-website "not_configured" concept: Settings manages the one underlying Google connection itself, not any specific website's use of it. */
  gsc: ConnectionState;
  ga4: ConnectionState;
  googleOAuthConfigured: boolean;
  /** Set right after the OAuth callback redirects back here (see src/auth/oauth-routes.ts's handleOAuthCallback), so the tenant lands on a real confirmation instead of a dead-end text page. */
  justConnected: "webmaster_console" | "analytics_property" | null;
}
