import { describe, expect, it } from "vitest";
import { markNotifiedOnce, markNotifiedWithCooldown } from "../../../src/email/dedup";

/** A tiny in-memory fake of the one table this touches. */
function fakeNotificationsDb() {
  const rows = new Map<string, string>(); // "tenant:noticeKey" -> sent_at (ISO)

  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT OR IGNORE")) {
                const [tenantId, noticeKey] = args as [string, string];
                const key = `${tenantId}:${noticeKey}`;
                if (rows.has(key)) return { success: true, meta: { changes: 0 } };
                rows.set(key, new Date().toISOString());
                return { success: true, meta: { changes: 1 } };
              }
              // The ON CONFLICT upsert used by markNotifiedWithCooldown.
              const [tenantId, noticeKey, sentAt] = args as [string, string, string];
              rows.set(`${tenantId}:${noticeKey}`, sentAt);
              return { success: true, meta: { changes: 1 } };
            },
            async first<T>() {
              const [tenantId, noticeKey] = args as [string, string];
              const sentAt = rows.get(`${tenantId}:${noticeKey}`);
              return (sentAt === undefined ? null : { sent_at: sentAt }) as T | null;
            }
          };
        }
      };
    }
  };
  return db as unknown as D1Database;
}

describe("markNotifiedOnce", () => {
  it("returns true the first time a key is seen for a tenant", async () => {
    const db = fakeNotificationsDb();
    expect(await markNotifiedOnce(db, "tenant-1", "welcome")).toBe(true);
  });

  it("returns false on every later call for the same tenant+key", async () => {
    const db = fakeNotificationsDb();
    await markNotifiedOnce(db, "tenant-1", "welcome");
    expect(await markNotifiedOnce(db, "tenant-1", "welcome")).toBe(false);
    expect(await markNotifiedOnce(db, "tenant-1", "welcome")).toBe(false);
  });

  it("tracks tenants and keys independently", async () => {
    const db = fakeNotificationsDb();
    await markNotifiedOnce(db, "tenant-1", "welcome");
    expect(await markNotifiedOnce(db, "tenant-2", "welcome")).toBe(true);
    expect(await markNotifiedOnce(db, "tenant-1", "quota_warning_80:2026-09")).toBe(true);
  });
});

describe("markNotifiedWithCooldown", () => {
  it("returns true and records sent_at the first time", async () => {
    const db = fakeNotificationsDb();
    const now = new Date("2026-09-02T12:00:00Z");
    expect(await markNotifiedWithCooldown(db, "tenant-1", "reconnect:webmaster_console", 24, now)).toBe(true);
  });

  it("returns false again within the cooldown window", async () => {
    const db = fakeNotificationsDb();
    const first = new Date("2026-09-02T12:00:00Z");
    await markNotifiedWithCooldown(db, "tenant-1", "reconnect:webmaster_console", 24, first);

    const soon = new Date("2026-09-02T18:00:00Z"); // 6h later, under the 24h cooldown
    expect(await markNotifiedWithCooldown(db, "tenant-1", "reconnect:webmaster_console", 24, soon)).toBe(false);
  });

  it("returns true again once the cooldown has elapsed", async () => {
    const db = fakeNotificationsDb();
    const first = new Date("2026-09-02T12:00:00Z");
    await markNotifiedWithCooldown(db, "tenant-1", "reconnect:webmaster_console", 24, first);

    const later = new Date("2026-09-04T00:00:00Z"); // 36h later, past the 24h cooldown
    expect(await markNotifiedWithCooldown(db, "tenant-1", "reconnect:webmaster_console", 24, later)).toBe(true);
  });
});
