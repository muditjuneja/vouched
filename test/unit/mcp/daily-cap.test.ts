import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../src/types/env";

const { consumeDailyToolCall } = vi.hoisted(() => ({ consumeDailyToolCall: vi.fn() }));
vi.mock("../../../src/db/daily-tool-calls", () => ({ consumeDailyToolCall }));

import { FREE_DAILY_TOOL_CALLS } from "../../../src/billing/quotas";
import { checkDailyCap } from "../../../src/mcp/daily-cap";

const env = { DB: {} as D1Database } as Env;

describe("checkDailyCap", () => {
  beforeEach(() => {
    consumeDailyToolCall.mockReset();
  });

  it("never counts self-host calls (no tenant)", async () => {
    expect(await checkDailyCap(env, null, null)).toBeNull();
    expect(consumeDailyToolCall).not.toHaveBeenCalled();
  });

  it("never counts paid-plan calls", async () => {
    expect(await checkDailyCap(env, "tenant-1", "pro")).toBeNull();
    expect(await checkDailyCap(env, "tenant-1", "team")).toBeNull();
    expect(consumeDailyToolCall).not.toHaveBeenCalled();
  });

  it("lets a free-plan call through while under the cap", async () => {
    consumeDailyToolCall.mockResolvedValueOnce({ allowed: true, used: 5 });
    expect(await checkDailyCap(env, "tenant-1", "free")).toBeNull();
    expect(consumeDailyToolCall).toHaveBeenCalledWith(env.DB, "tenant-1", FREE_DAILY_TOOL_CALLS);
  });

  it("refuses a free-plan call over the cap with an actionable message", async () => {
    consumeDailyToolCall.mockResolvedValueOnce({ allowed: false, used: FREE_DAILY_TOOL_CALLS + 1 });
    const message = await checkDailyCap(env, "tenant-1", "free");
    expect(message).toContain("daily_limit_exceeded");
    expect(message).toContain(String(FREE_DAILY_TOOL_CALLS));
  });
});
