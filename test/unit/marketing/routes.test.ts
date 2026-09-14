import { describe, expect, it } from "vitest";
import { marketing } from "../../../src/marketing/routes";
import { TOOL_PAGES } from "../../../src/marketing/content/tool-pages";
import type { Env } from "../../../src/types/env";

// The marketing sub-app needs no D1/R2/auth at all; every response is
// built from static data (the manifest + hand-written copy), so unlike
// the dashboard's route tests, these exercise real page bodies end to
// end, not just a gate. A bare `{}` cast stands in for Env since no
// binding is ever touched.
function fakeEnv(): Env {
  return {} as Env;
}

describe("marketing routes", () => {
  it("GET / renders the landing page with real product copy", async () => {
    const res = await marketing.request("/", {}, fakeEnv());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("mcp-seo-toolkit");
    expect(body).toContain("Model Context Protocol");
    expect(body).toContain("self-host");
    expect(body).toContain('<meta name="description"');
    expect(body).toContain('rel="canonical"');
    expect((body.match(/<h1/g) ?? []).length).toBe(1);
  });

  it("every page carries Open Graph / Twitter Card meta for link previews", async () => {
    const res = await marketing.request("/pricing", {}, fakeEnv());
    const body = await res.text();
    expect(body).toContain('property="og:title"');
    expect(body).toContain('property="og:description"');
    expect(body).toContain('property="og:url"');
    expect(body).toContain('name="twitter:card" content="summary"');
    expect(body).toContain('name="twitter:title"');
  });

  it("has a favicon", async () => {
    const res = await marketing.request("/", {}, fakeEnv());
    const body = await res.text();
    expect(body).toContain('rel="icon"');
  });

  it("GET /pricing shows the real quota-derived plan amounts", async () => {
    const res = await marketing.request("/pricing", {}, fakeEnv());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Free (self-host)");
    expect(body).toContain("Pro (cloud)");
    expect(body).toContain("Team (cloud)");
    expect(body).toContain("$4");
    expect(body).toContain("$20");
  });

  it("GET /tools lists every real tool", async () => {
    const res = await marketing.request("/tools", {}, fakeEnv());
    expect(res.status).toBe(200);
    const body = await res.text();
    for (const page of TOOL_PAGES) {
      expect(body).toContain(page.title);
    }
  });

  it("GET /tools/:slug renders a real tool page, 404s for an unknown tool", async () => {
    const ok = await marketing.request("/tools/audit-site", {}, fakeEnv());
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain("Fast technical/content health audit.");

    const missing = await marketing.request("/tools/not-a-real-tool", {}, fakeEnv());
    expect(missing.status).toBe(404);
  });

  it("GET /vs/ahrefs renders a structural, non-disparaging comparison", async () => {
    const res = await marketing.request("/vs/ahrefs", {}, fakeEnv());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Ahrefs");
    expect(body).toContain("MIT licensed");
    expect(body).toContain("Self-hostable");
  });

  it("GET /vs/semrush and /vs/open-seo also render", async () => {
    for (const slug of ["semrush", "open-seo"]) {
      const res = await marketing.request(`/vs/${slug}`, {}, fakeEnv());
      expect(res.status).toBe(200);
    }
  });

  it("GET /vs/unknown-competitor 404s", async () => {
    const res = await marketing.request("/vs/unknown-competitor", {}, fakeEnv());
    expect(res.status).toBe(404);
  });

  it("GET /for/agencies and /for/indie-hackers render distinct content", async () => {
    const agencies = await marketing.request("/for/agencies", {}, fakeEnv());
    const indies = await marketing.request("/for/indie-hackers", {}, fakeEnv());
    expect(agencies.status).toBe(200);
    expect(indies.status).toBe(200);
    const agenciesBody = await agencies.text();
    const indiesBody = await indies.text();
    expect(agenciesBody).not.toBe(indiesBody);
    expect(agenciesBody).toContain("For agencies");
    expect(indiesBody).toContain("For indie hackers");
  });

  it("GET /sitemap.xml lists real routes as absolute URLs off the request origin", async () => {
    const res = await marketing.request("https://myworker.example.com/sitemap.xml", {}, fakeEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/xml");
    const body = await res.text();
    expect(body).toContain("<loc>https://myworker.example.com/</loc>");
    expect(body).toContain("<loc>https://myworker.example.com/pricing</loc>");
  });

  it("GET /robots.txt points at the sitemap on the request's own origin", async () => {
    const res = await marketing.request("https://myworker.example.com/robots.txt", {}, fakeEnv());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Allow: /");
    expect(body).toContain("Sitemap: https://myworker.example.com/sitemap.xml");
  });
});
