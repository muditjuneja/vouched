import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../src/types/env";

const { verifyWebhook, onboardUser } = vi.hoisted(() => ({ verifyWebhook: vi.fn(), onboardUser: vi.fn(async () => {}) }));
vi.mock("@clerk/backend/webhooks", () => ({ verifyWebhook }));
vi.mock("../../../src/email/welcome", () => ({ onboardUser }));

import { handleClerkWebhook } from "../../../src/auth/clerk-webhook";

const env = { DB: {}, CLERK_WEBHOOK_SIGNING_SECRET: "whsec_test" } as unknown as Env;
const req = () => new Request("https://vouchedhq.com/webhooks/clerk", { method: "POST", body: "{}" });

beforeEach(() => {
  verifyWebhook.mockReset();
  onboardUser.mockClear();
});

describe("handleClerkWebhook", () => {
  it("404s when no signing secret is configured", async () => {
    const res = await handleClerkWebhook(req(), { DB: {} } as unknown as Env);
    expect(res.status).toBe(404);
    expect(verifyWebhook).not.toHaveBeenCalled();
  });

  it("rejects a bad signature without touching anything", async () => {
    verifyWebhook.mockRejectedValueOnce(new Error("bad sig"));
    const res = await handleClerkWebhook(req(), env);
    expect(res.status).toBe(400);
    expect(onboardUser).not.toHaveBeenCalled();
  });

  it("onboards the new user on user.created, with Clerk's creation time", async () => {
    verifyWebhook.mockResolvedValueOnce({ type: "user.created", data: { id: "user_9", created_at: Date.parse("2026-11-01T19:14:00Z") } });
    const res = await handleClerkWebhook(req(), env);
    expect(res.status).toBe(200);
    expect(verifyWebhook).toHaveBeenCalledWith(expect.any(Request), { signingSecret: "whsec_test" });
    expect(onboardUser).toHaveBeenCalledWith(env, "user_9", { source: "clerk_webhook", signedUpAt: "2026-11-01T19:14:00.000Z" });
  });

  it("acknowledges other events without acting on them", async () => {
    verifyWebhook.mockResolvedValueOnce({ type: "session.created", data: { id: "sess_1" } });
    const res = await handleClerkWebhook(req(), env);
    expect(res.status).toBe(200);
    expect(onboardUser).not.toHaveBeenCalled();
  });
});
