import { describe, expect, it } from "vitest";
import { checkAndIncrementRateLimit, currentMinuteBucket } from "../../../src/lib/rate-limit";

describe("currentMinuteBucket", () => {
  it("truncates to the minute in UTC", () => {
    expect(currentMinuteBucket(new Date("2026-09-02T23:11:47Z"))).toBe("2026-09-02T23:11");
  });
});

/** A tiny in-memory fake of the one table this touches. */
function fakeRateLimitDb() {
  const buckets = new Map<string, number>(); // "tenant:bucket" -> count

  const db = {
    prepare(_sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              const [tenantId, bucket] = args as [string, string];
              const key = `${tenantId}:${bucket}`;
              buckets.set(key, (buckets.get(key) ?? 0) + 1);
              return { success: true, meta: { changes: 1 } };
            },
            async first<T>() {
              const [tenantId, bucket] = args as [string, string];
              const count = buckets.get(`${tenantId}:${bucket}`);
              return (count === undefined ? null : { count }) as T | null;
            }
          };
        }
      };
    }
  };
  return db as unknown as D1Database;
}

describe("checkAndIncrementRateLimit", () => {
  it("allows requests at or under the limit", async () => {
    const db = fakeRateLimitDb();
    const now = new Date("2026-09-02T23:11:00Z");
    for (let i = 0; i < 5; i++) {
      expect(await checkAndIncrementRateLimit(db, "tenant-1", 5, now)).toBe(true);
    }
  });

  it("rejects once the limit is exceeded", async () => {
    const db = fakeRateLimitDb();
    const now = new Date("2026-09-02T23:11:00Z");
    for (let i = 0; i < 5; i++) {
      await checkAndIncrementRateLimit(db, "tenant-1", 5, now);
    }
    expect(await checkAndIncrementRateLimit(db, "tenant-1", 5, now)).toBe(false);
  });

  it("tracks tenants and minute buckets independently", async () => {
    const db = fakeRateLimitDb();
    const minuteOne = new Date("2026-09-02T23:11:00Z");
    const minuteTwo = new Date("2026-09-02T23:12:00Z");

    for (let i = 0; i < 5; i++) await checkAndIncrementRateLimit(db, "tenant-1", 5, minuteOne);
    // A different tenant, same minute, is unaffected.
    expect(await checkAndIncrementRateLimit(db, "tenant-2", 5, minuteOne)).toBe(true);
    // The same tenant, a new minute, resets.
    expect(await checkAndIncrementRateLimit(db, "tenant-1", 5, minuteTwo)).toBe(true);
  });
});
