import { describe, expect, it } from "vitest";
import { consumeDailyToolCall, currentDay } from "../../../src/db/daily-tool-calls";

/** In-memory fake of daily_tool_calls: just enough for the single INSERT ... ON CONFLICT ... RETURNING statement. */
function fakeDailyDb() {
  const counts = new Map<string, number>(); // "tenant|day" -> count
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (!sql.includes("RETURNING count")) throw new Error(`unexpected SQL: ${sql}`);
              const [tenantId, day] = args as [string, string];
              const key = `${tenantId}|${day}`;
              const next = (counts.get(key) ?? 0) + 1;
              counts.set(key, next);
              return { count: next } as T;
            }
          };
        }
      };
    }
  };
  return db as unknown as D1Database;
}

describe("currentDay", () => {
  it("formats a date as YYYY-MM-DD in UTC", () => {
    expect(currentDay(new Date("2026-09-24T23:59:59Z"))).toBe("2026-09-24");
  });
});

describe("consumeDailyToolCall", () => {
  const now = new Date("2026-09-24T10:00:00Z");

  it("allows calls up to and including the cap, then refuses", async () => {
    const db = fakeDailyDb();
    for (let i = 1; i <= 3; i++) {
      expect(await consumeDailyToolCall(db, "tenant-1", 3, now)).toEqual({ allowed: true, used: i });
    }
    expect(await consumeDailyToolCall(db, "tenant-1", 3, now)).toEqual({ allowed: false, used: 4 });
  });

  it("counts each tenant separately", async () => {
    const db = fakeDailyDb();
    await consumeDailyToolCall(db, "tenant-1", 1, now);
    expect((await consumeDailyToolCall(db, "tenant-2", 1, now)).allowed).toBe(true);
  });

  it("resets on a new UTC day", async () => {
    const db = fakeDailyDb();
    await consumeDailyToolCall(db, "tenant-1", 1, now);
    expect((await consumeDailyToolCall(db, "tenant-1", 1, now)).allowed).toBe(false);
    expect((await consumeDailyToolCall(db, "tenant-1", 1, new Date("2026-09-25T00:00:01Z"))).allowed).toBe(true);
  });
});
