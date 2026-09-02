import { describe, expect, it } from "vitest";
import { currentPeriod } from "../../../src/db/usage-counters";

describe("currentPeriod", () => {
  it("formats a date as YYYY-MM in UTC", () => {
    expect(currentPeriod(new Date("2026-09-02T12:00:00Z"))).toBe("2026-09");
    expect(currentPeriod(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01");
  });

  it("defaults to the current date when none is given", () => {
    const nowPeriod = new Date().toISOString().slice(0, 7);
    expect(currentPeriod()).toBe(nowPeriod);
  });
});
