import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../../src/types/env";

const { verifyApiKey } = vi.hoisted(() => ({ verifyApiKey: vi.fn() }));
vi.mock("../../../src/db/mcp-api-keys", () => ({ verifyApiKey }));

import { mcpResource, resolveApiKey } from "../../../src/auth/mcp-oauth";

const env = { DB: {} as D1Database } as Env;
const request = new Request("https://vouchedhq.com/mcp", { method: "POST" });

describe("resolveApiKey (API keys alongside OAuth)", () => {
  it("accepts a valid vsm_ key, for this server's /mcp resource, carrying its workspace and creator", async () => {
    verifyApiKey.mockResolvedValueOnce({ tenantId: "owner_1", createdBy: "user_2" });
    expect(await resolveApiKey({ token: "vsm_abc", request, env })).toEqual({
      props: { kind: "api_key", tenantId: "owner_1", createdBy: "user_2" },
      audience: "https://vouchedhq.com/mcp"
    });
  });

  it("rejects an unknown key, so the client gets the sign-in challenge", async () => {
    verifyApiKey.mockResolvedValueOnce(null);
    expect(await resolveApiKey({ token: "vsm_unknown", request, env })).toBeNull();
  });

  it("never looks up tokens that aren't API keys", async () => {
    verifyApiKey.mockClear();
    expect(await resolveApiKey({ token: "some-other-token", request, env })).toBeNull();
    expect(verifyApiKey).not.toHaveBeenCalled();
  });

  it("names the resource after the origin serving it", () => {
    expect(mcpResource("http://localhost:8787")).toBe("http://localhost:8787/mcp");
  });
});
