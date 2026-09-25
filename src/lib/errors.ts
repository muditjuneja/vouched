/**
 * Thrown by a gsc/analytics handler when the requested property has no
 * usable Google OAuth token yet. Mapped to a structured MCP tool error
 * (not a generic 500) so an agent can tell "not connected" apart from
 * "upstream failed".
 */
export class ConnectionRequiredError extends Error {
  readonly connection: "webmaster_console" | "analytics_property";

  constructor(connection: "webmaster_console" | "analytics_property", message?: string) {
    super(
      message ??
        `This tool needs your ${connection === "webmaster_console" ? "Search Console" : "Google Analytics"} account connected. Connect it in the Vouched dashboard under Settings → Google connections.`
    );
    this.name = "ConnectionRequiredError";
    this.connection = connection;
  }
}

/** A configuration problem (missing secret, malformed env), not the caller's fault. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Thrown by a DataForSEO-backed tool when a cloud tenant's bundled-access
 * usage has hit their plan's included quota for the current billing
 * period. Not thrown at all for self-host (BYOK has no quota) or for a
 * cloud tenant with their own key, only for bundled-access calls.
 */
export class QuotaExceededError extends Error {
  readonly plan: string;
  readonly quotaUsd: number;

  constructor(plan: string, quotaUsd: number) {
    super(
      `You've used the $${quotaUsd.toFixed(2)} of market data included in your ${plan} plan this month, and your overage wallet is empty. ` +
        "Top up the wallet from Billing to keep going, or wait for your next billing period. Your Google tools keep working."
    );
    this.name = "QuotaExceededError";
    this.plan = plan;
    this.quotaUsd = quotaUsd;
  }
}

/**
 * Thrown by a DataForSEO-backed tool when a cloud tenant is on the free
 * plan: paid market data (keywords, backlinks, SERPs) is a subscriber
 * feature, free workspaces get their own Google data only. Separate from
 * QuotaExceededError so an agent can tell "upgrade to use this at all"
 * apart from "you've used this month's allowance".
 */
export class UpgradeRequiredError extends Error {
  constructor() {
    super("This tool uses paid market data, which needs a Pro or Team plan. Free plans include your own Search Console and Analytics data.");
    this.name = "UpgradeRequiredError";
  }
}

/** An upstream API (DataForSEO, Google, a crawl target) failed or errored. */
export class UpstreamError extends Error {
  readonly upstream: string;
  readonly status?: number;

  constructor(upstream: string, message: string, status?: number) {
    super(`${upstream}: ${message}`);
    this.name = "UpstreamError";
    this.upstream = upstream;
    this.status = status;
  }
}

/**
 * An UpstreamError for a failed Google response, with only Google's own
 * one-line reason ("User does not have sufficient permissions for this
 * property", "Token has been expired or revoked"). A response that isn't
 * Google's JSON error (an HTML 404 page, a proxy error) never reaches the
 * agent: it becomes "request failed (HTTP 404)" and the body is logged.
 */
export async function googleUpstreamError(upstream: string, res: Response): Promise<UpstreamError> {
  const body = await res.text();
  let reason: string | null = null;
  try {
    const parsed = JSON.parse(body) as { error?: string | { message?: string }; error_description?: string };
    reason = typeof parsed.error === "object" ? (parsed.error.message ?? null) : (parsed.error_description ?? parsed.error ?? null);
  } catch {
    // Not JSON: fall through to the short message.
  }
  if (!reason) console.warn(`[${upstream}] HTTP ${res.status}: ${body.slice(0, 500)}`);
  return new UpstreamError(upstream, reason ? `${reason} (HTTP ${res.status})` : `request failed (HTTP ${res.status})`, res.status);
}
