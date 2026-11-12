import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../../src/types/env";

// Unlike clerk-webhook.test.ts, Clerk's real verifyWebhook runs here, inside
// the Workers runtime, against a payload signed exactly the way Clerk (Svix,
// Standard Webhooks) signs one: proves the dependency works on workerd.
const { onboardUser } = vi.hoisted(() => ({ onboardUser: vi.fn(async () => {}) }));
vi.mock("../../../src/email/welcome", () => ({ onboardUser }));

import { handleClerkWebhook } from "../../../src/auth/clerk-webhook";

const KEY = new TextEncoder().encode("a-test-signing-key-32-bytes-long");
const SECRET = `whsec_${btoa(String.fromCharCode(...KEY))}`;

async function signedRequest(body: string, { secretKey = KEY, timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const id = "msg_test_1";
  const key = await crypto.subtle.importKey("raw", secretKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return new Request("https://vouchedhq.com/webhooks/clerk", {
    method: "POST",
    headers: { "content-type": "application/json", "svix-id": id, "svix-timestamp": String(timestamp), "svix-signature": `v1,${signature}` },
    body
  });
}

const env = { DB: {}, CLERK_WEBHOOK_SIGNING_SECRET: SECRET } as unknown as Env;
const body = JSON.stringify({ type: "user.created", object: "event", data: { id: "user_real", created_at: Date.parse("2026-11-01T19:14:00Z") } });

describe("handleClerkWebhook with Clerk's real signature check", () => {
  it("accepts a correctly signed user.created and onboards the user", async () => {
    const res = await handleClerkWebhook(await signedRequest(body), env);
    expect(res.status).toBe(200);
    expect(onboardUser).toHaveBeenCalledWith(env, "user_real", { source: "clerk_webhook", signedUpAt: "2026-11-01T19:14:00.000Z" });
  });

  it("rejects one signed with a different secret", async () => {
    onboardUser.mockClear();
    const res = await handleClerkWebhook(await signedRequest(body, { secretKey: new TextEncoder().encode("some-other-key-entirely-32-bytes") }), env);
    expect(res.status).toBe(400);
    expect(onboardUser).not.toHaveBeenCalled();
  });

  it("rejects a replayed one with a stale timestamp", async () => {
    onboardUser.mockClear();
    const res = await handleClerkWebhook(await signedRequest(body, { timestamp: Math.floor(Date.now() / 1000) - 3600 }), env);
    expect(res.status).toBe(400);
    expect(onboardUser).not.toHaveBeenCalled();
  });
});
