import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendAdminAlert } from "../../../src/lib/alerts";
import type { Env } from "../../../src/types/env";

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATASETS: {} as R2Bucket,
    MCP_BEARER_TOKEN: "x",
    ...overrides
  };
}

describe("sendAdminAlert", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing over the network when no webhook is configured", async () => {
    await sendAdminAlert(fakeEnv(), "something happened");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts a body compatible with both Slack (text) and Discord (content) webhooks", async () => {
    const env = fakeEnv({ ADMIN_ALERT_WEBHOOK_URL: "https://hooks.example.com/abc" });
    await sendAdminAlert(env, "billing failed for tenant-1");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/abc");
    const body = JSON.parse(init.body as string);
    expect(body.text).toBe("billing failed for tenant-1");
    expect(body.content).toBe("billing failed for tenant-1");
  });

  it("never throws even if the webhook delivery fails", async () => {
    fetchSpy.mockRejectedValue(new Error("network down"));
    const env = fakeEnv({ ADMIN_ALERT_WEBHOOK_URL: "https://hooks.example.com/abc" });
    await expect(sendAdminAlert(env, "won't crash the caller")).resolves.toBeUndefined();
  });
});
