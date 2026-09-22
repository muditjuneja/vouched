import { describe, expect, it } from "vitest";
import { deleteToken, getAnyToken, upsertToken } from "../../../src/db/google-tokens";

/** A tiny in-memory fake of the google_tokens table, enough to exercise upsert/get/delete. */
function fakeGoogleTokensDb() {
  interface Row {
    account_email: string;
    scope_group: string;
    access_token: string;
    refresh_token: string;
    expires_at: string;
    tenant_id: string | null;
    updated_at: string;
  }
  const rows: Row[] = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT INTO google_tokens")) {
                const [accountEmail, scopeGroup, accessToken, refreshToken, expiresAt, tenantId] = args as [
                  string,
                  string,
                  string,
                  string,
                  string,
                  string | null
                ];
                const existing = rows.find((r) => r.account_email === accountEmail && r.scope_group === scopeGroup);
                if (existing) {
                  existing.access_token = accessToken;
                  existing.refresh_token = refreshToken;
                  existing.expires_at = expiresAt;
                  existing.tenant_id = tenantId;
                  existing.updated_at = new Date().toISOString();
                } else {
                  rows.push({
                    account_email: accountEmail,
                    scope_group: scopeGroup,
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    expires_at: expiresAt,
                    tenant_id: tenantId,
                    updated_at: new Date().toISOString()
                  });
                }
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.startsWith("DELETE FROM google_tokens")) {
                const [scopeGroup, tenantId] = args as [string, string | null];
                const before = rows.length;
                const remaining = rows.filter((r) => !(r.scope_group === scopeGroup && r.tenant_id === tenantId));
                rows.length = 0;
                rows.push(...remaining);
                return { success: true, meta: { changes: before - remaining.length } };
              }
              throw new Error(`unhandled run(): ${sql}`);
            },
            async first<T>() {
              if (sql.includes("ORDER BY updated_at DESC")) {
                const [scopeGroup, tenantId] = args as [string, string | null];
                const matches = rows.filter((r) => r.scope_group === scopeGroup && r.tenant_id === tenantId);
                matches.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
                return (matches[0] ?? null) as T | null;
              }
              throw new Error(`unhandled first(): ${sql}`);
            }
          };
        }
      };
    }
  };

  return db as unknown as D1Database;
}

describe("deleteToken", () => {
  it("removes a tenant's stored token for a scope group", async () => {
    const db = fakeGoogleTokensDb();
    await upsertToken(db, {
      account_email: "me@example.com",
      scope_group: "webmaster_console",
      access_token: "a",
      refresh_token: "r",
      expires_at: new Date().toISOString(),
      tenant_id: "tenant-1"
    });

    expect(await getAnyToken(db, "webmaster_console", "tenant-1")).not.toBeNull();
    expect(await deleteToken(db, "webmaster_console", "tenant-1")).toBe(true);
    expect(await getAnyToken(db, "webmaster_console", "tenant-1")).toBeNull();
  });

  it("returns false, and touches nothing, when nothing was connected", async () => {
    const db = fakeGoogleTokensDb();
    expect(await deleteToken(db, "webmaster_console", "tenant-1")).toBe(false);
  });

  it("never disconnects another tenant's token", async () => {
    const db = fakeGoogleTokensDb();
    await upsertToken(db, {
      account_email: "them@example.com",
      scope_group: "webmaster_console",
      access_token: "a",
      refresh_token: "r",
      expires_at: new Date().toISOString(),
      tenant_id: "tenant-2"
    });

    expect(await deleteToken(db, "webmaster_console", "tenant-1")).toBe(false);
    expect(await getAnyToken(db, "webmaster_console", "tenant-2")).not.toBeNull();
  });
});
