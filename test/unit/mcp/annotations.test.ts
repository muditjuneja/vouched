import { describe, expect, it } from "vitest";
import { toolAnnotations } from "../../../src/mcp/server";

describe("toolAnnotations", () => {
  it("marks every tool read-only, non-destructive and safe to repeat", () => {
    expect(toolAnnotations("inspect_serp")).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true });
  });

  it("flags tools that reach Google or market-data providers as open-world, and our own-data tools as closed", () => {
    expect(toolAnnotations("inspect_serp").openWorldHint).toBe(true);
    expect(toolAnnotations("get_search_performance").openWorldHint).toBe(true);
    expect(toolAnnotations("list_websites").openWorldHint).toBe(false);
    expect(toolAnnotations("export_dataset").openWorldHint).toBe(false);
  });
});
