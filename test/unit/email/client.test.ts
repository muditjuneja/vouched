import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "../../../src/email/client";
import type { Env } from "../../../src/types/env";

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATASETS: {} as R2Bucket,
    MCP_BEARER_TOKEN: "x",
    XMIT_API_KEY: "pm_live_test",
    XMIT_FROM_EMAIL: "noreply@example.com",
    ...overrides
  };
}

describe("sendEmail", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to xmit.sh's default base URL with a Bearer token and the expected JSON body", async () => {
    const ok = await sendEmail(fakeEnv(), { to: "user@example.com", subject: "Hi", html: "<p>hi</p>" });
    expect(ok).toBe(true);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.xmit.sh/email/send");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer pm_live_test");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      from: "noreply@example.com",
      to: "user@example.com",
      subject: "Hi",
      html: "<p>hi</p>"
    });
  });

  it("honors XMIT_API_BASE_URL when set", async () => {
    await sendEmail(fakeEnv({ XMIT_API_BASE_URL: "https://xmit.example.internal" }), {
      to: "user@example.com",
      subject: "Hi",
      html: "<p>hi</p>"
    });
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe("https://xmit.example.internal/email/send");
  });

  it("an explicit from overrides XMIT_FROM_EMAIL", async () => {
    await sendEmail(fakeEnv(), { to: "user@example.com", subject: "Hi", html: "<p>hi</p>", from: "alerts@example.com" });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).from).toBe("alerts@example.com");
  });

  it("returns false without a network call when XMIT_API_KEY is unset", async () => {
    const ok = await sendEmail(fakeEnv({ XMIT_API_KEY: undefined }), {
      to: "user@example.com",
      subject: "Hi",
      html: "<p>hi</p>"
    });
    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns false without a network call when there's no from address", async () => {
    const ok = await sendEmail(fakeEnv({ XMIT_FROM_EMAIL: undefined }), {
      to: "user@example.com",
      subject: "Hi",
      html: "<p>hi</p>"
    });
    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns false, never throws, on a non-2xx response", async () => {
    fetchSpy.mockResolvedValue(new Response("bad request", { status: 400 }));
    const ok = await sendEmail(fakeEnv(), { to: "user@example.com", subject: "Hi", html: "<p>hi</p>" });
    expect(ok).toBe(false);
  });

  it("returns false, never throws, if fetch itself rejects", async () => {
    fetchSpy.mockRejectedValue(new Error("network down"));
    await expect(sendEmail(fakeEnv(), { to: "user@example.com", subject: "Hi", html: "<p>hi</p>" })).resolves.toBe(
      false
    );
  });
});
