import type { ConnectionState } from "../auth/google-oauth";
import type { McpApiKeyRow } from "../db/mcp-api-keys";
import type { Plan } from "../db/subscriptions";
import type { WebsiteRow } from "../db/websites";

export interface DashboardWebsite {
  row: WebsiteRow;
  gsc: ConnectionState | "not_configured";
  ga4: ConnectionState | "not_configured";
}

export interface DashboardData {
  websites: DashboardWebsite[];
  plan: Plan;
  usageUsd: number;
  quotaUsd: number;
  apiKeys: McpApiKeyRow[];
  googleOAuthConfigured: boolean;
  dodoConfigured: boolean;
}
