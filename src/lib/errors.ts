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
        `This tool needs a connected ${connection} account. Run the Google OAuth connect flow first.`
    );
    this.name = "ConnectionRequiredError";
    this.connection = connection;
  }
}

/** A configuration problem (missing secret, malformed env) — not the caller's fault. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
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
