import type { ConnectionState } from "../auth/google-oauth";
import type { CostLogRow } from "../clients/dataforseo/cost-tracker";
import type { GA4Property } from "../clients/google/analytics-ga4";
import type { SearchConsoleSite } from "../clients/google/search-console";
import type { McpApiKeyRow } from "../db/mcp-api-keys";
import type { Plan, SubscriptionStatus, WalletLedgerRow } from "../db/subscriptions";
import type { WebsiteRow } from "../db/websites";
import type { DiscoveredProperty } from "./discovery";

export interface DashboardUser {
  /** The signed-in person's own email, not the workspace owner's. */
  email: string | null;
  /** The workspace's plan (the team's plan for a member). */
  plan: Plan;
  tenantId: string;
  role: "owner" | "member";
}

/** Settings' team section. Present for anyone on or owning a team, or whose team membership is paused. */
export interface TeamSettings {
  role: "owner" | "member";
  seatLimit: number;
  ownerEmail: string | null;
  members: { userId: string; email: string | null; joinedAt: string }[];
  pendingInvites: { inviteId: string; email: string; expiresAt: string }[];
  /** Owner on the Team plan with a free seat: shows the invite form. */
  canInvite: boolean;
  /** Set when the user is a member of a team whose plan lapsed: they're in their personal workspace until it's renewed. */
  pausedTeamOwnerEmail: string | null;
}

export interface ActionNotice {
  type: "success" | "warn" | "info";
  message: string;
}

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
  user?: DashboardUser;
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
  workerOrigin?: string;
  hasApiKeys?: boolean;
  gscConnected?: boolean;
  ga4Connected?: boolean;
  notice?: ActionNotice | null;
}

export interface WebsitesData {
  user?: DashboardUser;
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
   * The tenant's Google properties that aren't tracked yet, matched by
   * domain across GSC/GA4 and ready to track with one click, no name/url
   * typing at all: see src/dashboard/discovery.ts. Empty whenever nothing
   * new was found, whether because nothing's connected, the account has no
   * properties, or everything discoverable is already tracked; the widget
   * tells those cases apart via gscState/ga4State, not this list alone.
   */
  discovered: DiscoveredProperty[];
  /** Set right after the OAuth callback redirects back here (see src/auth/oauth-routes.ts's handleOAuthCallback), so a connect started from this page lands on a real confirmation right here instead of over on Settings. */
  justConnected: "webmaster_console" | "analytics_property" | null;
  notice?: ActionNotice | null;
  /** Discovered Google properties available for selection when editing a website in its slide drawer. */
  gscSites?: SearchConsoleSite[] | null;
  ga4Properties?: GA4Property[] | null;
  /** ID of website whose edit side drawer should be open on initial load. */
  editingWebsiteId?: string | null;
}

export interface UsageData {
  user?: DashboardUser;
  rows: CostLogRow[];
  nextBeforeId: number | null;
  totalCalls?: number;
  periodSpendUsd?: number;
  quotaUsd?: number;
}

export interface BillingData {
  user?: DashboardUser;
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
  /** False for team members: billing is owner-only, so they see a note instead of upgrade/top-up forms. */
  canManageBilling: boolean;
  notice?: ActionNotice | null;
}

export interface SettingsData {
  user?: DashboardUser;
  email: string | null;
  tenantId?: string;
  plan?: Plan;
  apiKeys: McpApiKeyRow[];
  /** Tenant-wide connection state, unlike WebsitesData's per-website "not_configured" concept: Settings manages the one underlying Google connection itself, not any specific website's use of it. */
  gsc: ConnectionState;
  ga4: ConnectionState;
  googleOAuthConfigured: boolean;
  /** Set right after the OAuth callback redirects back here (see src/auth/oauth-routes.ts's handleOAuthCallback), so the tenant lands on a real confirmation instead of a dead-end text page. */
  justConnected: "webmaster_console" | "analytics_property" | null;
  notice?: ActionNotice | null;
  team?: TeamSettings | null;
}

export interface ApiKeyCreatedData {
  user?: DashboardUser;
  plaintext: string;
  workerOrigin?: string;
}


