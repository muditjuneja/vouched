import { describe, expect, it } from "vitest";
import { createApiKey, listApiKeys, revokeApiKey, revokeKeysCreatedBy, verifyApiKey } from "../../../src/db/mcp-api-keys";

/**
 * A tiny in-memory fake of the one table mcp-api-keys.ts touches, enough
 * to exercise the real create/verify/list/revoke round trip (hashing
 * included, via the real Web Crypto available in Node's test runtime)
 * without a real D1 binding. Mirrors the SQL's own rule that a key with no
 * recorded creator belongs to the owner (COALESCE(created_by, tenant_id)).
 */
function fakeApiKeysDb() {
  interface Row {
    key_id: string;
    key_hash: string;
    tenant_id: string;
    label: string | null;
    created_by: string | null;
    created_at: string;
    last_used_at: string | null;
  }
  const rows: Row[] = [];
  const creator = (r: Row) => r.created_by ?? r.tenant_id;

  function remove(predicate: (r: Row) => boolean) {
    const before = rows.length;
    const remaining = rows.filter((r) => !predicate(r));
    rows.length = 0;
    rows.push(...remaining);
    return { success: true, meta: { changes: before - remaining.length } };
  }

  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT")) {
                const [keyId, keyHash, tenantId, label, createdBy] = args as [string, string, string, string | null, string];
                rows.push({
                  key_id: keyId,
                  key_hash: keyHash,
                  tenant_id: tenantId,
                  label,
                  created_by: createdBy,
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
              if (sql.startsWith("DELETE") && sql.includes("key_id = ?1")) {
                const [keyId, tenantId, userId] = args as [string, string, string];
                return remove((r) => r.key_id === keyId && r.tenant_id === tenantId && creator(r) === userId);
              }
              if (sql.startsWith("DELETE") && sql.includes("created_by = ?2")) {
                const [tenantId, userId] = args as [string, string];
                return remove((r) => r.tenant_id === tenantId && r.created_by === userId);
              }
              throw new Error(`unhandled run(): ${sql}`);
            },
            async first<T>() {
              if (sql.includes("WHERE key_hash = ?1")) {
                const [keyHash] = args as [string];
                const row = rows.find((r) => r.key_hash === keyHash);
                return (row ? { tenant_id: row.tenant_id, created_by: row.created_by } : null) as T | null;
              }
              throw new Error(`unhandled first(): ${sql}`);
            },
            async all<T>() {
              if (sql.includes("WHERE tenant_id = ?1")) {
                const [tenantId, userId] = args as [string, string];
                const results = rows
                  .filter((r) => r.tenant_id === tenantId && creator(r) === userId)
                  .map(({ key_id, tenant_id, label, created_at, last_used_at }) => ({ key_id, tenant_id, label, created_at, last_used_at }));
                return { success: true, meta: { changes: 0 }, results } as unknown as { success: true; meta: { changes: number }; results: T[] };
              }
              throw new Error(`unhandled all(): ${sql}`);
            }
          };
        }
      };
    }
  };

  return { db: db as unknown as D1Database, rows };
}

describe("mcp-api-keys round trip", () => {
  it("creates a key, verifies it back to the right tenant and creator, and rejects a wrong one", async () => {
    const { db } = fakeApiKeysDb();
    const created = await createApiKey(db, "tenant-1", "my laptop");

    expect(created.plaintext).toMatch(/^vsm_[0-9a-f]+$/);
    expect(await verifyApiKey(db, created.plaintext)).toEqual({ tenantId: "tenant-1", createdBy: "tenant-1" });
    expect(await verifyApiKey(db, "vsm_not_a_real_key")).toBeNull();
    expect(await verifyApiKey(db, "totally-wrong-prefix")).toBeNull();
  });

  it("treats a key from before seats existed (no creator recorded) as the owner's", async () => {
    const { db, rows } = fakeApiKeysDb();
    const created = await createApiKey(db, "tenant-1", "old key");
    rows[0]!.created_by = null;
    expect(await verifyApiKey(db, created.plaintext)).toEqual({ tenantId: "tenant-1", createdBy: "tenant-1" });
    expect(await listApiKeys(db, "tenant-1")).toHaveLength(1);
  });

  it("lists keys for a tenant without ever exposing the hash or plaintext", async () => {
    const { db } = fakeApiKeysDb();
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
    const { db } = fakeApiKeysDb();
    const mine = await createApiKey(db, "tenant-1", "mine");
    const theirs = await createApiKey(db, "tenant-2", "theirs");

    expect(await revokeApiKey(db, "tenant-1", theirs.keyId)).toBe(false);
    expect(await verifyApiKey(db, theirs.plaintext)).toEqual({ tenantId: "tenant-2", createdBy: "tenant-2" });

    expect(await revokeApiKey(db, "tenant-1", mine.keyId)).toBe(true);
    expect(await verifyApiKey(db, mine.plaintext)).toBeNull();
  });
});

describe("mcp-api-keys on a team", () => {
  it("shows each person only their own keys in the shared workspace", async () => {
    const { db } = fakeApiKeysDb();
    await createApiKey(db, "owner", "owner key");
    await createApiKey(db, "owner", "member key", "member-1");

    expect((await listApiKeys(db, "owner", "owner")).map((k) => k.label)).toEqual(["owner key"]);
    expect((await listApiKeys(db, "owner", "member-1")).map((k) => k.label)).toEqual(["member key"]);
  });

  it("won't let one member revoke another person's key", async () => {
    const { db } = fakeApiKeysDb();
    const ownerKey = await createApiKey(db, "owner", "owner key");
    expect(await revokeApiKey(db, "owner", ownerKey.keyId, "member-1")).toBe(false);
    expect(await verifyApiKey(db, ownerKey.plaintext)).not.toBeNull();
  });

  it("revokes every key a removed member created, and nobody else's", async () => {
    const { db } = fakeApiKeysDb();
    const ownerKey = await createApiKey(db, "owner", "owner key");
    const memberKey = await createApiKey(db, "owner", "member key", "member-1");
    const otherKey = await createApiKey(db, "owner", "other member", "member-2");

    expect(await revokeKeysCreatedBy(db, "owner", "member-1")).toBe(1);
    expect(await verifyApiKey(db, memberKey.plaintext)).toBeNull();
    expect(await verifyApiKey(db, ownerKey.plaintext)).not.toBeNull();
    expect(await verifyApiKey(db, otherKey.plaintext)).not.toBeNull();
  });
});
