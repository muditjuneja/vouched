import { describe, expect, it } from "vitest";
import { addWebsite, deleteWebsite, getWebsiteById, listWebsites, updateWebsite, type WebsiteRow } from "../../../src/db/websites";

/**
 * A tiny in-memory fake of the one table websites.ts touches — enough to
 * exercise the real add/get/update/delete round trip, including the
 * tenant-scoping that's the whole security story for update/delete,
 * without a real D1 binding (unavailable in this sandbox, see README).
 */
function fakeWebsitesDb() {
  const rows: WebsiteRow[] = [];

  function match(row: WebsiteRow, websiteId: string, tenantId: string | null): boolean {
    return row.website_id === websiteId && row.tenant_id === tenantId;
  }

  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT INTO websites")) {
                const [websiteId, name, primaryDomain, isDefault, gscSiteUrl, ga4PropertyId, tenantId] = args as [
                  string,
                  string,
                  string,
                  number,
                  string | null,
                  string | null,
                  string | null
                ];
                rows.push({
                  website_id: websiteId,
                  name,
                  primary_domain: primaryDomain,
                  is_default: isDefault,
                  gsc_site_url: gscSiteUrl,
                  ga4_property_id: ga4PropertyId,
                  tenant_id: tenantId,
                  created_at: new Date().toISOString()
                });
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.startsWith("UPDATE websites")) {
                // Last two bound params are always websiteId, tenantId (see updateWebsite's dynamic SET clause).
                const websiteId = args[args.length - 2] as string;
                const tenantId = args[args.length - 1] as string | null;
                const row = rows.find((r) => match(r, websiteId, tenantId));
                if (!row) return { success: true, meta: { changes: 0 } };
                // Re-derive which fields the SET clause touched from the SQL text itself, matching bound values positionally.
                const setFields = sql
                  .slice(sql.indexOf("SET ") + 4, sql.indexOf(" WHERE"))
                  .split(", ")
                  .map((clause) => clause.split(" = ")[0]!.trim());
                setFields.forEach((field, i) => {
                  const value = args[i];
                  if (field === "name") row.name = value as string;
                  if (field === "primary_domain") row.primary_domain = value as string;
                  if (field === "gsc_site_url") row.gsc_site_url = value as string | null;
                  if (field === "ga4_property_id") row.ga4_property_id = value as string | null;
                });
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.startsWith("DELETE FROM websites")) {
                const [websiteId, tenantId] = args as [string, string | null];
                const before = rows.length;
                const remaining = rows.filter((r) => !match(r, websiteId, tenantId));
                rows.length = 0;
                rows.push(...remaining);
                return { success: true, meta: { changes: before - remaining.length } };
              }
              throw new Error(`unhandled run(): ${sql}`);
            },
            async first<T>() {
              if (sql.includes("WHERE website_id = ?1 AND tenant_id IS ?2")) {
                const [websiteId, tenantId] = args as [string, string | null];
                const row = rows.find((r) => match(r, websiteId, tenantId));
                return (row ?? null) as T | null;
              }
              if (sql.includes("WHERE primary_domain = ?1 AND tenant_id IS ?2")) {
                const [domain, tenantId] = args as [string, string | null];
                const row = rows.find((r) => r.primary_domain === domain && r.tenant_id === tenantId);
                return (row ?? null) as T | null;
              }
              throw new Error(`unhandled first(): ${sql}`);
            },
            async all<T>() {
              if (sql.includes("WHERE tenant_id IS ?1")) {
                const [tenantId] = args as [string | null];
                return { success: true, meta: { changes: 0 }, results: rows.filter((r) => r.tenant_id === tenantId) as unknown as T[] };
              }
              throw new Error(`unhandled all(): ${sql}`);
            }
          };
        }
      };
    }
  };

  return { db: db as unknown as D1Database };
}

describe("websites CRUD", () => {
  it("adds a website and reads it back", async () => {
    const { db } = fakeWebsitesDb();
    const created = await addWebsite(db, { name: "Example", primaryDomain: "example.com" }, "tenant-1");
    expect(created.name).toBe("Example");

    const byId = await getWebsiteById(db, created.website_id, "tenant-1");
    expect(byId?.primary_domain).toBe("example.com");
  });

  it("never finds another tenant's website by id", async () => {
    const { db } = fakeWebsitesDb();
    const created = await addWebsite(db, { name: "Example", primaryDomain: "example.com" }, "tenant-1");
    expect(await getWebsiteById(db, created.website_id, "tenant-2")).toBeNull();
  });

  it("updates only the fields provided, leaving others untouched", async () => {
    const { db } = fakeWebsitesDb();
    const created = await addWebsite(db, { name: "Old name", primaryDomain: "example.com", gscSiteUrl: "sc-domain:example.com" }, "tenant-1");

    const updated = await updateWebsite(db, created.website_id, { name: "New name" }, "tenant-1");
    expect(updated?.name).toBe("New name");
    expect(updated?.primary_domain).toBe("example.com"); // untouched
    expect(updated?.gsc_site_url).toBe("sc-domain:example.com"); // untouched
  });

  it("clears a nullable field when explicitly set to null, distinct from being absent", async () => {
    const { db } = fakeWebsitesDb();
    const created = await addWebsite(db, { name: "Example", primaryDomain: "example.com", gscSiteUrl: "sc-domain:example.com" }, "tenant-1");

    const updated = await updateWebsite(db, created.website_id, { gscSiteUrl: null }, "tenant-1");
    expect(updated?.gsc_site_url).toBeNull();
  });

  it("never updates another tenant's website by id-guessing", async () => {
    const { db } = fakeWebsitesDb();
    const created = await addWebsite(db, { name: "Example", primaryDomain: "example.com" }, "tenant-1");

    const result = await updateWebsite(db, created.website_id, { name: "Hijacked" }, "tenant-2");
    expect(result).toBeNull();
    expect((await getWebsiteById(db, created.website_id, "tenant-1"))?.name).toBe("Example"); // untouched
  });

  it("deletes a website and returns true only when a row actually existed for that tenant", async () => {
    const { db } = fakeWebsitesDb();
    const created = await addWebsite(db, { name: "Example", primaryDomain: "example.com" }, "tenant-1");

    expect(await deleteWebsite(db, created.website_id, "tenant-2")).toBe(false); // wrong tenant
    expect(await deleteWebsite(db, created.website_id, "tenant-1")).toBe(true);
    expect(await getWebsiteById(db, created.website_id, "tenant-1")).toBeNull();
  });

  it("listWebsites only returns a tenant's own rows", async () => {
    const { db } = fakeWebsitesDb();
    await addWebsite(db, { name: "Mine", primaryDomain: "mine.com" }, "tenant-1");
    await addWebsite(db, { name: "Theirs", primaryDomain: "theirs.com" }, "tenant-2");

    const mine = await listWebsites(db, "tenant-1");
    expect(mine.map((w) => w.name)).toEqual(["Mine"]);
  });
});
