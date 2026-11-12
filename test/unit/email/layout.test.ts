import { describe, expect, it } from "vitest";
import { escapeHtml, renderEmail } from "../../../src/email/layout";
import { welcomeEmail } from "../../../src/email/notifications";

describe("renderEmail", () => {
  const { html, text } = renderEmail({
    preheader: "Preview line",
    eyebrow: "Billing",
    heading: "Thanks. <em>Pro</em> is active.",
    blocks: [
      { kind: "p", html: "Hello <strong>there</strong>." },
      { kind: "steps", items: [{ title: "Add your site", html: "Pick a domain." }, { title: "Connect Google", html: "Read-only." }] },
      { kind: "facts", title: "Plan", rows: [{ label: "Tool calls", value: "100 / day" }] },
      { kind: "code", label: "MCP server URL", text: "https://vouchedhq.com/mcp?a=<b>" },
      { kind: "note", html: "Heads up." }
    ],
    cta: { label: "Open Billing", href: "https://vouchedhq.com/dashboard/billing" }
  });

  it("renders a full themed document with the preheader, brand mark and CTA", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Preview line");
    expect(html).toContain("/brand/icon-512.png");
    expect(html).toContain("#f3eadc"); // brand paper
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain('href="https://vouchedhq.com/dashboard/billing"');
    expect(html).toContain(">01<");
    expect(html).toContain(">02<");
  });

  it("escapes code-block text, which can carry user input", () => {
    expect(html).toContain("https://vouchedhq.com/mcp?a=&lt;b&gt;");
    expect(html).not.toContain("?a=<b>");
  });

  it("renders a readable plain-text copy from the same content, without markup or chrome", () => {
    expect(text).toContain("Thanks. Pro is active.");
    expect(text).toContain("Hello there.");
    expect(text).toContain("1. Add your site\n   Pick a domain.");
    expect(text).toContain("- Tool calls: 100 / day");
    expect(text).toContain("Open Billing: https://vouchedhq.com/dashboard/billing");
    expect(text).not.toMatch(/<(p|strong|em|table|td|a)\b/);
  });
});

describe("welcomeEmail", () => {
  it("walks a dashboard or webhook signup through site, Google and connecting a client", () => {
    const { subject, content } = welcomeEmail();
    expect(subject).toContain("Welcome");
    const { text } = renderEmail(content);
    expect(text).toContain("Add your site");
    expect(text).toContain("Connect Google");
    expect(text).toContain("https://vouchedhq.com/mcp");
    expect(text).toContain("Free");
  });

  it("speaks to someone who arrived through an MCP client, naming it, without telling them to connect one", () => {
    const { subject, content } = welcomeEmail({ clientName: "Cursor" });
    expect(subject).toBe("Cursor is connected to Vouched. One step left.");
    const { text } = renderEmail(content);
    expect(text).toContain("Ask Cursor");
    expect(text).not.toContain("MCP server URL");
  });

  it("escapes a hostile client name, since clients name themselves", () => {
    const { html } = renderEmail(welcomeEmail({ clientName: '<img src=x onerror="alert(1)">' }).content);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain(escapeHtml("<img src=x"));
  });

  it("shows paid-plan facts instead of the free cap when the person is already on a paid plan", () => {
    const { text } = renderEmail(welcomeEmail({ plan: "team" }).content);
    expect(text).toContain("No daily cap");
    expect(text).not.toContain("100 / day");
  });
});

describe("welcomeEmail button placement", () => {
  it("puts the call to action right after the steps, above the plan table", () => {
    const { text } = renderEmail(welcomeEmail({ clientName: "Cursor" }).content);
    expect(text.indexOf("Add your site: https://vouchedhq.com/dashboard/websites")).toBeLessThan(text.indexOf("Your plan"));
    expect(text.match(/Add your site: /g)).toHaveLength(1);
  });
});
