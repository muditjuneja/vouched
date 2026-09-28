import { describe, expect, it } from "vitest";
import { buildAuthUrl } from "../../../src/auth/google-oauth";
import type { Env } from "../../../src/types/env";

// buildAuthUrl is the one pure (no D1, no fetch) piece of google-oauth.ts:
// everything else (getValidAccessToken, checkConnectionState, the token
// exchange/refresh calls) touches D1 and/or Google's endpoints directly and
// is exercised under @cloudflare/vitest-pool-workers instead (see README's
// sandbox-limitation note for why that suite doesn't run in this sandbox).

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATASETS: {} as R2Bucket,
    CACHE: {} as KVNamespace,
    MCP_BEARER_TOKEN: "test-token",
    GOOGLE_OAUTH_CLIENT_ID: "client-123",
    GOOGLE_OAUTH_CLIENT_SECRET: "secret",
    ...overrides
  };
}

describe("buildAuthUrl", () => {
  it("requests the read-only webmasters scope plus openid/email for the gsc scope group", () => {
    const url = new URL(buildAuthUrl(fakeEnv(), "https://worker.example/oauth/google/callback", "webmaster_console", "n1"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")).toContain("https://www.googleapis.com/auth/webmasters.readonly");
    expect(url.searchParams.get("scope")).toContain("openid");
  });

  it("requests the read-only analytics scope for the analytics scope group", () => {
    const url = new URL(buildAuthUrl(fakeEnv(), "https://worker.example/oauth/google/callback", "analytics_property", "n1"));
    expect(url.searchParams.get("scope")).toContain("https://www.googleapis.com/auth/analytics.readonly");
  });

  it("always requests offline access + forces consent, so a refresh_token is guaranteed", () => {
    const url = new URL(buildAuthUrl(fakeEnv(), "https://worker.example/oauth/google/callback", "webmaster_console", "n1"));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("carries the client id and redirect uri through untouched", () => {
    const url = new URL(
      buildAuthUrl(fakeEnv({ GOOGLE_OAUTH_CLIENT_ID: "abc" }), "https://worker.example/oauth/google/callback", "webmaster_console", "n1")
    );
    expect(url.searchParams.get("client_id")).toBe("abc");
    expect(url.searchParams.get("redirect_uri")).toBe("https://worker.example/oauth/google/callback");
  });

  it("puts the scope, return page and nonce into state, defaulting returnTo to settings", () => {
    const url = new URL(buildAuthUrl(fakeEnv(), "https://worker.example/oauth/google/callback", "webmaster_console", "n1"));
    expect(url.searchParams.get("state")).toBe("webmaster_console:settings:n1");
  });

  it("threads a websites returnTo through state so the callback can send the tenant back to the page they started from", () => {
    const url = new URL(buildAuthUrl(fakeEnv(), "https://worker.example/oauth/google/callback", "webmaster_console", "n1", "websites"));
    expect(url.searchParams.get("state")).toBe("webmaster_console:websites:n1");
  });

  it("never names a tenant in state: the callback takes it from the session", () => {
    const url = new URL(buildAuthUrl(fakeEnv(), "https://worker.example/oauth/google/callback", "analytics_property", "n1"));
    expect(url.searchParams.get("state")).toBe("analytics_property:settings:n1");
  });
});
