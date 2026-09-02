import { describe, expect, it } from "vitest";
import { esc } from "../../../src/dashboard/html";

describe("esc", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(esc(`<script>alert('x')&"y"</script>`)).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&amp;&quot;y&quot;&lt;/script&gt;"
    );
  });

  it("leaves plain text untouched", () => {
    expect(esc("example.com")).toBe("example.com");
  });
});
