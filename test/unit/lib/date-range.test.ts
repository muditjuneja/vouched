import { describe, expect, it } from "vitest";
import { assertDateRange } from "../../../src/lib/date-range";
import { InvalidInputError } from "../../../src/lib/errors";

describe("assertDateRange", () => {
  it("accepts an ordered range, including a single day", () => {
    expect(() => assertDateRange("2026-09-01", "2026-09-30")).not.toThrow();
    expect(() => assertDateRange("2026-09-01", "2026-09-01")).not.toThrow();
  });

  it("rejects a reversed range or an impossible date", () => {
    expect(() => assertDateRange("2026-09-30", "2026-09-01")).toThrow(InvalidInputError);
    expect(() => assertDateRange("2026-02-30", "2026-03-01")).toThrow(InvalidInputError);
  });
});
