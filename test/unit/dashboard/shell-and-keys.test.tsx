import { describe, expect, it } from "vitest";
import { Sidebar } from "../../../src/dashboard/components/Sidebar";
import { renderApiKeyCreated } from "../../../src/dashboard/pages/ApiKeyCreatedPage";
import { renderToString } from "../../../src/design";


describe("Sidebar component", () => {
  it("renders nav entries and fallback back-link when user is not provided", () => {
    const html = renderToString(<Sidebar activePath="/dashboard" />);
    expect(html).toContain("Overview");
    expect(html).toContain("Websites");
    expect(html).toContain("← Back to site");
  });

  it("renders user avatar, email, plan, and sign out link when user is provided", () => {
    const html = renderToString(
      <Sidebar
        activePath="/dashboard"
        user={{
          email: "alex@example.com",
          plan: "pro",
          tenantId: "user_123",
          role: "owner"
        }}
      />
    );
    expect(html).toContain("alex@example.com");
    expect(html).toContain("pro plan");
    expect(html).toContain("A"); // avatar initial
    expect(html).toContain('href="/dashboard/logout"');
    expect(html).toContain("Sign out");
  });
});

describe("renderApiKeyCreated", () => {
  it("renders key, copy buttons, and multi-client configuration snippets", () => {
    const html = renderApiKeyCreated("vouch_live_abc123", "https://seo-mcp.workers.dev", {
      email: "test@example.com",
      plan: "team",
      tenantId: "t_1",
      role: "owner"
    });
    expect(html).toContain("vouch_live_abc123");
    expect(html).toContain('data-copy="vouch_live_abc123"');
    expect(html).toContain("Copy key");
    expect(html).toContain("Claude Code / CLI");
    expect(html).toContain("Cursor (.cursor/mcp.json)");
    expect(html).toContain("Claude Desktop (claude_desktop_config.json)");
    expect(html).toContain("https://seo-mcp.workers.dev/mcp");
    expect(html).toContain('href="/dashboard/api-keys"');
  });
});

describe("renderApiKeys", () => {
  const row = { key_id: "k1", tenant_id: "t_1", label: "<b>laptop</b>", created_at: "2026-09-23", last_used_at: null };

  it("lists keys with revoke actions, escaping labels, with the create drawer closed by default", async () => {
    const { renderApiKeys } = await import("../../../src/dashboard/pages/ApiKeysPage");
    const html = renderApiKeys({ apiKeys: [row], openCreate: false });
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("/dashboard/api-keys/k1/revoke");
    expect(html).not.toContain("<b>laptop</b>");
    expect(html).toContain('action="/dashboard/api-keys"');
    expect(html).not.toMatch(/id="create-api-key-toggle"[^>]*checked/);
  });

  it("starts with the drawer open when linked with ?new=1, and shows an empty state with no keys", async () => {
    const { renderApiKeys } = await import("../../../src/dashboard/pages/ApiKeysPage");
    const html = renderApiKeys({ apiKeys: [], openCreate: true });
    expect(html).toMatch(/id="create-api-key-toggle"[^>]*checked/);
    expect(html).toContain("No keys yet");
  });
});

describe("Dashboard layout and table alignment", () => {
  it("includes fixed-height shell and vertical-align middle rules in layout CSS", async () => {
    const { renderPage } = await import("../../../src/dashboard/Layout");
    const html = renderPage({
      title: "Test",
      activePath: "/dashboard",
      children: <div>Content</div>
    });
    expect(html).toContain("height: 100vh");
    expect(html).toContain("vertical-align: middle");
    expect(html).toContain(".col-actions");
    expect(html).toContain(".row-actions");
    expect(html).toContain(".site-domain-row");
    expect(html).toContain(".btn-copy-inline");
  });
});
