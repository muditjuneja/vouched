import { describe, expect, it } from "vitest";
import { dashboard } from "../../../src/dashboard/routes";
import type { Env } from "../../../src/types/env";

// Only the gate behavior in dashboard.use("*", ...) is covered here — it
// runs before any D1 access, so it's testable without a real D1 binding
// (unavailable in this sandbox, see README). The routes behind the gate
// (listing websites, creating API keys, etc.) touch D1 and are exercised
// under @cloudflare/vitest-pool-workers instead.

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATASETS: {} as R2Bucket,
    MCP_BEARER_TOKEN: "x",
    ...overrides
  };
}

describe("dashboard gate", () => {
  it("404s entirely outside cloud mode, before ever checking for a session", async () => {
    const res = await dashboard.request("/", {}, fakeEnv());
    expect(res.status).toBe(404);
  });

  it("requires a Clerk session in cloud mode and offers a sign-in link when configured", async () => {
    const env = fakeEnv({
      CLOUD_MODE: "1",
      CLERK_SECRET_KEY: "sk_test",
      CLERK_SIGN_IN_URL: "https://accounts.example.com/sign-in"
    });
    const res = await dashboard.request("/", {}, env);
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toContain("accounts.example.com/sign-in");
    expect(body).toContain("redirect_url=");
  });

  it("still 401s without crashing when no sign-in URL is configured", async () => {
    const env = fakeEnv({ CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test" });
    const res = await dashboard.request("/", {}, env);
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("No sign-in page is configured");
  });
});
