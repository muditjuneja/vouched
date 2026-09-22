import { describe, expect, it } from "vitest";
import { listCostLog, type CostLogRow } from "../../../src/clients/dataforseo/cost-tracker";
import type { Env } from "../../../src/types/env";

/** A tiny in-memory fake of the cost_log table, enough to exercise listCostLog's id-cursor pagination and tenant scoping. */
function fakeCostLogEnv() {
  const rows: CostLogRow[] = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async all<T>() {
              if (sql.includes("id < ?2")) {
                const [tenantId, beforeId, limit] = args as [string | null, number, number];
                const results = rows
                  .filter((r) => r.tenant_id === tenantId && r.id < beforeId)
                  .sort((a, b) => b.id - a.id)
                  .slice(0, limit);
                return { success: true, meta: { changes: 0 }, results: results as unknown as T[] };
              }
              if (sql.includes("FROM cost_log")) {
                const [tenantId, limit] = args as [string | null, number];
                const results = rows
                  .filter((r) => r.tenant_id === tenantId)
                  .sort((a, b) => b.id - a.id)
                  .slice(0, limit);
                return { success: true, meta: { changes: 0 }, results: results as unknown as T[] };
              }
              throw new Error(`unhandled all(): ${sql}`);
            }
          };
        }
      };
    }
  };

  return {
    env: { DB: db as unknown as D1Database } as Env,
    addRow: (row: Omit<CostLogRow, "id">) => rows.push({ ...row, id: rows.length + 1 })
  };
}

describe("listCostLog", () => {
  it("returns a tenant's own rows, most recent first", async () => {
    const { env, addRow } = fakeCostLogEnv();
    addRow({ tool_name: "research_keywords", endpoint: "/v3/a", cost_usd: 0.01, called_at: "2026-01-01T00:00:00Z", tenant_id: "tenant-1" });
    addRow({ tool_name: "inspect_domain", endpoint: "/v3/b", cost_usd: 0.02, called_at: "2026-01-02T00:00:00Z", tenant_id: "tenant-1" });
    addRow({ tool_name: "research_keywords", endpoint: "/v3/a", cost_usd: 0.01, called_at: "2026-01-01T00:00:00Z", tenant_id: "tenant-2" });

    const rows = await listCostLog(env, "tenant-1");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.tool_name).toBe("inspect_domain"); // most recent (highest id) first
  });

  it("respects the limit", async () => {
    const { env, addRow } = fakeCostLogEnv();
    for (let i = 0; i < 5; i++) {
      addRow({ tool_name: "research_keywords", endpoint: "/v3/a", cost_usd: 0.01, called_at: "2026-01-01T00:00:00Z", tenant_id: "tenant-1" });
    }
    expect(await listCostLog(env, "tenant-1", { limit: 3 })).toHaveLength(3);
  });

  it("beforeId fetches only older rows, for cursor-based pagination", async () => {
    const { env, addRow } = fakeCostLogEnv();
    for (let i = 0; i < 5; i++) {
      addRow({ tool_name: "research_keywords", endpoint: "/v3/a", cost_usd: 0.01, called_at: "2026-01-01T00:00:00Z", tenant_id: "tenant-1" });
    }
    // ids are 1..5; the first page (no cursor) with limit 3 returns ids 5,4,3.
    const firstPage = await listCostLog(env, "tenant-1", { limit: 3 });
    expect(firstPage.map((r) => r.id)).toEqual([5, 4, 3]);

    const nextPage = await listCostLog(env, "tenant-1", { limit: 3, beforeId: firstPage[firstPage.length - 1]!.id });
    expect(nextPage.map((r) => r.id)).toEqual([2, 1]);
  });

  it("defaults to a null tenant (self-host) when none is given", async () => {
    const { env, addRow } = fakeCostLogEnv();
    addRow({ tool_name: "research_keywords", endpoint: "/v3/a", cost_usd: 0.01, called_at: "2026-01-01T00:00:00Z", tenant_id: null });
    expect(await listCostLog(env)).toHaveLength(1);
  });
});
