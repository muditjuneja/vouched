import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebsiteRow } from "../../../../src/db/websites";
import type { Env } from "../../../../src/types/env";

const { listWebsites } = vi.hoisted(() => ({ listWebsites: vi.fn() }));
vi.mock("../../../../src/db/websites", () => ({ listWebsites }));

const { checkConnectionState } = vi.hoisted(() => ({ checkConnectionState: vi.fn(async () => "connected") }));
vi.mock("../../../../src/auth/google-oauth", () => ({ checkConnectionState }));

import { listWebsitesTool } from "../../../../src/domains/core/list-websites";

const env = { DB: {} } as unknown as Env;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("list_websites", () => {
  it("lists each tracked site with the connections it has a property for", async () => {
    listWebsites.mockResolvedValueOnce([
      { website_id: "w1", name: "xmit", primary_domain: "xmit.sh", gsc_site_url: "sc-domain:xmit.sh", ga4_property_id: null } as WebsiteRow
    ]);
    const result = await listWebsitesTool.handler({}, env);
    expect(result.data.connection_required).toBe(false);
    expect(result.entities[0]).toMatchObject({
      id: "property:w1",
      attrs: { primary_domain: "xmit.sh", connections: { search_console: "connected", website_analytics: "not_connected" } }
    });
  });

  it("with nothing tracked, tells the agent any site in the connected Google account works, without importing anything", async () => {
    listWebsites.mockResolvedValueOnce([]);
    const result = await listWebsitesTool.handler({}, env);
    expect(result.data.connection_required).toBe(true);
    expect(result.coverage.scope_note).toContain("any site in the connected Google account");
    expect(checkConnectionState).not.toHaveBeenCalled();
  });
});
