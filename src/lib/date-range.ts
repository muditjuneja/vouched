import { z } from "zod";
import { InvalidInputError } from "./errors";

/** A calendar date as Google's reporting APIs take it. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .describe("YYYY-MM-DD");

/**
 * Rejects an impossible date (2026-02-30) or a reversed range before it
 * reaches Google, which would otherwise answer with a bare HTTP 400.
 */
export function assertDateRange(startDate: string, endDate: string): void {
  for (const value of [startDate, endDate]) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new InvalidInputError(`${value} is not a real calendar date (expected YYYY-MM-DD).`);
    }
  }
  if (startDate > endDate) {
    throw new InvalidInputError(`startDate ${startDate} is after endDate ${endDate}; swap them.`);
  }
}
