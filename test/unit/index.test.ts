import { describe, expect, it } from "vitest";
import app from "../../src/index";
import type { Env } from "../../src/types/env";

// Only the routes/paths that don't need real D1/R2 bindings are covered
// here (health checks, the bearer-token gate's rejection paths) — a
// successful /mcp call needs a fully bound Env and is exercised under
// @cloudflare/vitest-pool-workers instead (see README's sandbox-limitation
// note for why that suite doesn't run in this sandbox).

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATASETS: {} as R2Bucket,
    MCP_BEARER_TOKEN: "correct-token",
    ...overrides
  };
}

describe("Hono app — routes not requiring D1/R2", () => {
  it("GET / serves the marketing landing page", async () => {
    const res = await app.request("/", {}, fakeEnv());
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Vouched");
  });

  it("GET /health reports ok", async () => {
    const res = await app.request("/health", {}, fakeEnv());
    expect(res.status).toBe(200);
  });

  it("/mcp without an Authorization header is unauthorized", async () => {
    const res = await app.request("/mcp", {}, fakeEnv());
    expect(res.status).toBe(401);
  });

  it("/mcp with the wrong bearer token is unauthorized", async () => {
    const res = await app.request(
      "/mcp",
      { headers: { Authorization: "Bearer wrong-token" } },
      fakeEnv()
    );
    expect(res.status).toBe(401);
  });

  it("/mcp is misconfigured (500) when MCP_BEARER_TOKEN isn't set", async () => {
    const res = await app.request(
      "/mcp",
      { headers: { Authorization: "Bearer anything" } },
      fakeEnv({ MCP_BEARER_TOKEN: "" })
    );
    expect(res.status).toBe(500);
  });
});
