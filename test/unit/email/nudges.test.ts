import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../src/types/env";

const m = vi.hoisted(() => ({
  notifyConnectGoogleNudge: vi.fn(async () => true),
  sendAdminAlert: vi.fn(async () => {}),
  sendOnce: vi.fn(async (_db: unknown, _t: string, _k: string, send: () => Promise<boolean>) => send()),
  markNotifiedWithCooldown: vi.fn(async (..._args: unknown[]) => true)
}));
vi.mock("../../../src/email/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/email/notifications")>()),
  notifyConnectGoogleNudge: m.notifyConnectGoogleNudge
}));
vi.mock("../../../src/lib/alerts", () => ({ sendAdminAlert: m.sendAdminAlert }));
vi.mock("../../../src/email/dedup", () => ({ sendOnce: m.sendOnce, markNotifiedWithCooldown: m.markNotifiedWithCooldown }));

import { CONNECT_GOOGLE_NUDGE_ATTEMPT_KEY, CONNECT_GOOGLE_NUDGE_KEY, findConnectGoogleNudges, runNudges } from "../../../src/email/nudges";
import { connectGoogleNudgeEmail } from "../../../src/email/notifications";
import { renderEmail } from "../../../src/email/layout";

/** Captures the one query findConnectGoogleNudges issues and returns canned rows. */
function fakeDb(rows: { user_id: string; first_client_name: string | null }[]) {
  const calls: { sql: string; args: unknown[] }[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          calls.push({ sql, args });
          return { all: async () => ({ results: rows }) };
        }
      };
    }
  };
  return { db: db as unknown as D1Database, calls };
}

const cloud = (db: D1Database) => ({ DB: db, CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk", XMIT_API_KEY: "k" }) as unknown as Env;

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockClear();
});

describe("findConnectGoogleNudges", () => {
  it("asks for signups from 14 days to 24 hours ago, not yet nudged, not tried in the last day, no Google in their workspace, whether or not a client is known", async () => {
    const { db, calls } = fakeDb([]);
    await findConnectGoogleNudges(db, new Date("2026-11-13T15:00:00.000Z"));
    expect(calls).toHaveLength(1);
    const { sql, args } = calls[0]!;
    expect(args).toEqual([
      "2026-11-12T15:00:00.000Z",
      "2026-10-30T15:00:00.000Z",
      CONNECT_GOOGLE_NUDGE_KEY,
      CONNECT_GOOGLE_NUDGE_ATTEMPT_KEY,
      "2026-11-12T15:00:00.000Z",
      10
    ]);
    expect(sql).toContain("julianday(n.sent_at)");
    expect(sql).toContain("julianday(s.signed_up_at)");
    expect(sql).toContain("FROM google_tokens");
    expect(sql).toContain("tenant_members");
    // API-key users never get a client name recorded; they must not be filtered out.
    expect(sql).not.toContain("first_client_name IS NOT NULL");
  });
});

describe("runNudges", () => {
  it("nudges each candidate once, naming their client when known, and tells the operator", async () => {
    const { db } = fakeDb([
      { user_id: "user_a", first_client_name: "Cursor" },
      { user_id: "user_b", first_client_name: null }
    ]);
    const env = cloud(db);
    expect(await runNudges(env)).toEqual({ sent: 2, candidates: 2 });
    expect(m.sendOnce).toHaveBeenCalledWith(db, "user_a", CONNECT_GOOGLE_NUDGE_KEY, expect.any(Function));
    expect(m.notifyConnectGoogleNudge).toHaveBeenCalledWith(env, "user_a", "Cursor");
    expect(m.notifyConnectGoogleNudge).toHaveBeenCalledWith(env, "user_b", null);
    expect(m.sendAdminAlert).toHaveBeenCalledOnce();
  });

  it("stamps the attempt before sending, so a failing address is retried once a day, not every hour", async () => {
    const { db } = fakeDb([{ user_id: "user_a", first_client_name: null }]);
    const now = new Date("2026-11-13T15:00:00.000Z");
    await runNudges(cloud(db), now);
    expect(m.markNotifiedWithCooldown).toHaveBeenCalledWith(db, "user_a", CONNECT_GOOGLE_NUDGE_ATTEMPT_KEY, 24, now);
    expect(m.markNotifiedWithCooldown.mock.invocationCallOrder[0]).toBeLessThan(m.sendOnce.mock.invocationCallOrder[0]!);
  });

  it("skips someone already tried within the day, even if the query let them through", async () => {
    const { db } = fakeDb([{ user_id: "user_a", first_client_name: null }]);
    m.markNotifiedWithCooldown.mockResolvedValueOnce(false);
    expect(await runNudges(cloud(db))).toEqual({ sent: 0, candidates: 1 });
    expect(m.sendOnce).not.toHaveBeenCalled();
  });

  it("counts only the sends that went out, so a failed one is retried tomorrow", async () => {
    const { db } = fakeDb([{ user_id: "user_a", first_client_name: null }]);
    m.sendOnce.mockResolvedValueOnce(false);
    expect(await runNudges(cloud(db))).toEqual({ sent: 0, candidates: 1 });
    expect(m.sendAdminAlert).not.toHaveBeenCalled();
  });

  it("stays quiet when there's nobody to nudge", async () => {
    const { db } = fakeDb([]);
    expect(await runNudges(cloud(db))).toEqual({ sent: 0, candidates: 0 });
    expect(m.sendAdminAlert).not.toHaveBeenCalled();
  });

  it("does nothing on self-host or without email configured", async () => {
    const { db, calls } = fakeDb([{ user_id: "user_a", first_client_name: "Cursor" }]);
    await runNudges({ DB: db, XMIT_API_KEY: "k" } as unknown as Env);
    await runNudges({ DB: db, CLOUD_MODE: "1", CLERK_SECRET_KEY: "sk" } as unknown as Env);
    expect(calls).toHaveLength(0);
    expect(m.notifyConnectGoogleNudge).not.toHaveBeenCalled();
  });

  it("never throws, even if the query fails", async () => {
    const db = { prepare: () => ({ bind: () => ({ all: async () => Promise.reject(new Error("D1 down")) }) }) } as unknown as D1Database;
    await expect(runNudges(cloud(db))).resolves.toEqual({ sent: 0, candidates: 0 });
  });
});

describe("connectGoogleNudgeEmail", () => {
  it("names the client and points straight at connecting Google", () => {
    const { subject, content } = connectGoogleNudgeEmail("Cursor");
    expect(subject).toBe("Cursor can't see your site yet");
    const { text } = renderEmail(content);
    expect(text).toContain("Connect Google: https://vouchedhq.com/dashboard/websites");
    expect(text).toContain("Ask Cursor");
  });

  it("without a known client, sends the general version that also covers connecting one", () => {
    for (const unknown of [null, undefined, ""]) {
      const { subject, content } = connectGoogleNudgeEmail(unknown);
      expect(subject).toBe("Your Vouched setup is one step from real data");
      const { text } = renderEmail(content);
      expect(text).toContain("Connect your AI client");
      expect(text).toContain("https://vouchedhq.com/mcp");
      expect(text).toContain("Connect Google: https://vouchedhq.com/dashboard/websites");
    }
  });

  it("escapes the client name in the HTML", () => {
    const { html } = renderEmail(connectGoogleNudgeEmail("<b>x</b>").content);
    expect(html).not.toContain("<b>x</b>");
  });
});
