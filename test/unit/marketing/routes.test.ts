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
    expect(body).toContain("Vouched");
    expect(body).toContain("vouched-seo-mcp");
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
    expect(body).toContain('name="twitter:card" content="summary_large_image"');
    expect(body).toContain('name="twitter:title"');
  });

  it("has a favicon", async () => {
    const res = await marketing.request("/", {}, fakeEnv());
    const body = await res.text();
    expect(body).toContain('rel="icon"');
  });

  it("GET /pricing shows the real plan amounts and included quotas", async () => {
    const res = await marketing.request("/pricing", {}, fakeEnv());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Community (self-host)");
    expect(body).toContain("Pro (Cloud)");
    expect(body).toContain("Team (Cloud)");
    expect(body).toContain("$10");
    expect(body).toContain("$50");
    expect(body).toContain("$4");
    expect(body).toContain("$20");
  });

  it("GET /docs renders the tools/docs index and /docs/:slug redirects", async () => {
    const docs = await marketing.request("/docs", {}, fakeEnv());
    expect(docs.status).toBe(200);
    const docsBody = await docs.text();
    expect(docsBody).toContain("All");

    const slugRedirect = await marketing.request("/docs/research-keywords", {}, fakeEnv());
    expect(slugRedirect.status).toBe(301);
    expect(slugRedirect.headers.get("Location")).toBe("/tools/research-keywords");

    const toolsRedirect = await marketing.request("/docs/tools", {}, fakeEnv());
    expect(toolsRedirect.status).toBe(301);
    expect(toolsRedirect.headers.get("Location")).toBe("/tools");
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

  it("GET /vs/semrush also renders", async () => {
    const res = await marketing.request("/vs/semrush", {}, fakeEnv());
    expect(res.status).toBe(200);
  });

  it("GET /vs/open-seo is gone (the comparison was removed)", async () => {
    const res = await marketing.request("/vs/open-seo", {}, fakeEnv());
    expect(res.status).toBe(404);
  });

  it("GET /privacy and /terms render, with the Limited Use statement Google's review looks for", async () => {
    const privacy = await marketing.request("/privacy", {}, fakeEnv());
    expect(privacy.status).toBe(200);
    const body = await privacy.text();
    expect(body).toContain("Limited Use");
    expect(body).toContain("api-services-user-data-policy");
    expect((await marketing.request("/terms", {}, fakeEnv())).status).toBe(200);
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

describe("marketing pages for a signed-in visitor", () => {
  const cloudEnv = { CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk_test" } as unknown as Env;
  const signedIn = { headers: { Cookie: "__client_uat=1790000000; __session=x" } };

  it("swaps Start on Cloud for Open dashboard, and the nav's Cloud for Dashboard", async () => {
    const body = await (await marketing.request("/", signedIn, cloudEnv)).text();
    expect(body).toContain("Open dashboard");
    expect(body).not.toContain("Start on Cloud");
    expect(body).toMatch(/class="btn" href="\/dashboard">\s*Dashboard/);
  });

  it("sends a signed-in visitor's plan buttons to Billing", async () => {
    const body = await (await marketing.request("/pricing", signedIn, cloudEnv)).text();
    expect(body).toContain('href="/dashboard/billing"');
    expect(body).toContain("Choose Pro in Billing");
  });

  it("shows the normal page once signed out (Clerk resets the cookie to 0)", async () => {
    const body = await (await marketing.request("/", { headers: { Cookie: "__client_uat=0" } }, cloudEnv)).text();
    expect(body).toContain("Start on Cloud");
    expect(body).not.toContain("Open dashboard");
  });

  it("never lets a shared cache store one visitor's copy for another", async () => {
    const res = await marketing.request("/", signedIn, cloudEnv);
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(res.headers.get("Vary")).toContain("Cookie");
  });
});

describe("brand images", () => {
  it.each([
    ["/og.png", "image/png"],
    ["/brand/icon-512.png", "image/png"],
    ["/brand/icon-180.png", "image/png"],
    ["/brand/icon.svg", "image/svg+xml"]
  ])("serves %s as %s", async (path, type) => {
    const res = await marketing.request(path, {}, fakeEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(type);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (type === "image/png") expect([...bytes.slice(1, 4)].map((b) => String.fromCharCode(b)).join("")).toBe("PNG");
  });

  it("points every page's share preview at the social image, on the page's own origin", async () => {
    const body = await (await marketing.request("https://vouchedhq.com/pricing", {}, fakeEnv())).text();
    expect(body).toContain('property="og:image" content="https://vouchedhq.com/og.png"');
    expect(body).toContain('name="twitter:card" content="summary_large_image"');
    expect(body).toContain('rel="apple-touch-icon" href="/brand/icon-180.png"');
  });
});
