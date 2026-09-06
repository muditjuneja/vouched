import { describe, expect, it } from "vitest";
import { createApiKey, listApiKeys, revokeApiKey, verifyApiKey } from "../../../src/db/mcp-api-keys";

/**
 * A tiny in-memory fake of the one table mcp-api-keys.ts touches — enough
 * to exercise the real create/verify/list/revoke round trip (hashing
 * included, via the real Web Crypto available in Node's test runtime)
 * without a real D1 binding (unavailable in this sandbox — see README).
 */
function fakeApiKeysDb() {
  interface Row {
    key_id: string;
    key_hash: string;
    tenant_id: string;
    label: string | null;
    created_at: string;
    last_used_at: string | null;
  }
  const rows: Row[] = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT")) {
                const [keyId, keyHash, tenantId, label] = args as [string, string, string, string | null];
                rows.push({
                  key_id: keyId,
                  key_hash: keyHash,
                  tenant_id: tenantId,
                  label,
                  created_at: new Date().toISOString(),
                  last_used_at: null
                });
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.startsWith("UPDATE")) {
                const [keyHash] = args as [string];
                const row = rows.find((r) => r.key_hash === keyHash);
                if (row) row.last_used_at = new Date().toISOString();
                return { success: true, meta: { changes: row ? 1 : 0 } };
              }
              if (sql.startsWith("DELETE")) {
                const [keyId, tenantId] = args as [string, string];
                const before = rows.length;
                const remaining = rows.filter((r) => !(r.key_id === keyId && r.tenant_id === tenantId));
                rows.length = 0;
                rows.push(...remaining);
                return { success: true, meta: { changes: before - remaining.length } };
              }
              throw new Error(`unhandled run(): ${sql}`);
            },
            async first<T>() {
              if (sql.includes("WHERE key_hash = ?1")) {
                const [keyHash] = args as [string];
                const row = rows.find((r) => r.key_hash === keyHash);
                return (row ? { tenant_id: row.tenant_id } : null) as T | null;
              }
              throw new Error(`unhandled first(): ${sql}`);
            },
            async all<T>() {
              if (sql.includes("WHERE tenant_id = ?1")) {
                const [tenantId] = args as [string];
                const results = rows
                  .filter((r) => r.tenant_id === tenantId)
                  .map(({ key_id, tenant_id, label, created_at, last_used_at }) => ({
                    key_id,
                    tenant_id,
                    label,
                    created_at,
                    last_used_at
                  }));
                return { success: true, meta: { changes: 0 }, results } as unknown as {
                  success: true;
                  meta: { changes: number };
                  results: T[];
                };
              }
              throw new Error(`unhandled all(): ${sql}`);
            }
          };
        }
      };
    }
  };

  return db as unknown as D1Database;
}

describe("mcp-api-keys round trip", () => {
  it("creates a key, verifies it back to the right tenant, and rejects a wrong one", async () => {
    const db = fakeApiKeysDb();
    const created = await createApiKey(db, "tenant-1", "my laptop");

    expect(created.plaintext).toMatch(/^vsm_[0-9a-f]+$/);
    expect(await verifyApiKey(db, created.plaintext)).toBe("tenant-1");
    expect(await verifyApiKey(db, "vsm_not_a_real_key")).toBeNull();
    expect(await verifyApiKey(db, "totally-wrong-prefix")).toBeNull();
  });

  it("lists keys for a tenant without ever exposing the hash or plaintext", async () => {
    const db = fakeApiKeysDb();
    await createApiKey(db, "tenant-1", "laptop");
    await createApiKey(db, "tenant-1", "server");
    await createApiKey(db, "tenant-2", "someone else's key");

    const keys = await listApiKeys(db, "tenant-1");
    expect(keys).toHaveLength(2);
    expect(keys.map((k) => k.label).sort()).toEqual(["laptop", "server"]);
    for (const key of keys) {
      expect(key).not.toHaveProperty("key_hash");
      expect(key).not.toHaveProperty("plaintext");
    }
  });

  it("revokes a key so it no longer verifies, and can't revoke another tenant's key", async () => {
    const db = fakeApiKeysDb();
    const mine = await createApiKey(db, "tenant-1", "mine");
    const theirs = await createApiKey(db, "tenant-2", "theirs");

    expect(await revokeApiKey(db, "tenant-1", theirs.keyId)).toBe(false);
    expect(await verifyApiKey(db, theirs.plaintext)).toBe("tenant-2"); // untouched

    expect(await revokeApiKey(db, "tenant-1", mine.keyId)).toBe(true);
    expect(await verifyApiKey(db, mine.plaintext)).toBeNull();
  });
});
