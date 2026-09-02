import type { createClerkClient } from "@clerk/backend";
import { describe, expect, it } from "vitest";
import { extractSessionToken, getTenantEmail } from "../../../src/auth/clerk";
import type { Env } from "../../../src/types/env";

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATASETS: {} as R2Bucket,
    MCP_BEARER_TOKEN: "x",
    CLERK_SECRET_KEY: "sk_test",
    ...overrides
  };
}

/** Minimal stand-in for ClerkClient — just enough of .users.getUser's result shape for getTenantEmail to read. */
function fakeClerkClient(
  user: { primaryEmailAddressId: string | null; emailAddresses: { id: string; emailAddress: string }[] } | null
): typeof createClerkClient {
  return (() => ({
    users: {
      async getUser() {
        if (!user) throw new Error("not found");
        return user;
      }
    }
  })) as unknown as typeof createClerkClient;
}

describe("extractSessionToken", () => {
  it("prefers an Authorization: Bearer header over any cookie", () => {
    const req = new Request("https://example.com/", {
      headers: {
        Authorization: "Bearer header-token",
        Cookie: "__session=cookie-token"
      }
    });
    expect(extractSessionToken(req)).toBe("header-token");
  });

  it("falls back to the __session cookie when there's no Authorization header", () => {
    const req = new Request("https://example.com/", {
      headers: { Cookie: "other=1; __session=cookie-token; more=2" }
    });
    expect(extractSessionToken(req)).toBe("cookie-token");
  });

  it("returns null when neither is present", () => {
    const req = new Request("https://example.com/");
    expect(extractSessionToken(req)).toBeNull();
  });

  it("ignores a non-Bearer Authorization header and still checks the cookie", () => {
    const req = new Request("https://example.com/", {
      headers: {
        Authorization: "Basic dXNlcjpwYXNz",
        Cookie: "__session=cookie-token"
      }
    });
    expect(extractSessionToken(req)).toBe("cookie-token");
  });
});

describe("getTenantEmail", () => {
  it("returns the primary email address when one is set", async () => {
    const makeClient = fakeClerkClient({
      primaryEmailAddressId: "idn_2",
      emailAddresses: [
        { id: "idn_1", emailAddress: "old@example.com" },
        { id: "idn_2", emailAddress: "primary@example.com" }
      ]
    });
    expect(await getTenantEmail(fakeEnv(), "user_1", makeClient)).toBe("primary@example.com");
  });

  it("falls back to the first email address when there's no primary match", async () => {
    const makeClient = fakeClerkClient({
      primaryEmailAddressId: null,
      emailAddresses: [{ id: "idn_1", emailAddress: "only@example.com" }]
    });
    expect(await getTenantEmail(fakeEnv(), "user_1", makeClient)).toBe("only@example.com");
  });

  it("returns null when the user has no email addresses at all", async () => {
    const makeClient = fakeClerkClient({ primaryEmailAddressId: null, emailAddresses: [] });
    expect(await getTenantEmail(fakeEnv(), "user_1", makeClient)).toBeNull();
  });

  it("returns null, never throws, when the lookup itself fails", async () => {
    const makeClient = fakeClerkClient(null);
    await expect(getTenantEmail(fakeEnv(), "user_1", makeClient)).resolves.toBeNull();
  });
});
