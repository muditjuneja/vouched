import { describe, expect, it } from "vitest";
import { extractSessionToken } from "../../../src/auth/clerk";

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
