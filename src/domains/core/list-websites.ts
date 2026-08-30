import { z } from "zod";
import { hasAnyToken } from "../../db/google-tokens";
import { listWebsites as queryWebsites } from "../../db/websites";
import { propertyEntityId } from "../../envelope/entities";
import { envelope } from "../../envelope/builder";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

type ConnectionState = "connected" | "not_connected";

async function connectionState(
  db: D1Database,
  configured: string | null,
  scopeGroup: "webmaster_console" | "analytics_property"
): Promise<ConnectionState> {
  if (!configured) return "not_connected";
  // NOTE: this only checks *some* token exists for the scope group, not that
  // it's specifically valid for this website's property, or unexpired — M3
  // (Google OAuth) adds real per-property refresh/validity checks and the
  // "reconnect_required" state on top of this.
  return (await hasAnyToken(db, scopeGroup)) ? "connected" : "not_connected";
}

async function handler(_args: Record<string, never>, env: Env) {
  const websites = await queryWebsites(env.DB);

  if (websites.length === 0) {
    return envelope("core", { connection_required: true, websites: [] })
      .setCoverage({ returned: 0, total: 0, as_of: null, scope_note: "no websites configured yet" })
      .build();
  }

  const builder = envelope("core", { connection_required: false });

  for (const site of websites) {
    const [searchConsole, websiteAnalytics] = await Promise.all([
      connectionState(env.DB, site.gsc_site_url, "webmaster_console"),
      connectionState(env.DB, site.ga4_property_id, "analytics_property")
    ]);

    builder.addEntity({
      id: propertyEntityId(site.website_id),
      kind: "property",
      label: site.name,
      attrs: {
        primary_domain: site.primary_domain,
        connections: {
          search_console: searchConsole,
          website_analytics: websiteAnalytics
        }
      }
    });
  }

  return builder
    .setCoverage({ returned: websites.length, total: websites.length, as_of: null, scope_note: null })
    .build();
}

export const listWebsitesTool: ToolModule<z.ZodObject<Record<string, never>>> = {
  name: "list_websites",
  title: "List websites",
  description: "List tracked/owned websites and their connection state.",
  inputSchema: z.object({}),
  handler
};
