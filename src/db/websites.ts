export interface WebsiteRow {
  website_id: string;
  name: string;
  primary_domain: string;
  is_default: number;
  gsc_site_url: string | null;
  ga4_property_id: string | null;
  tenant_id: string | null;
  created_at: string;
}

/**
 * Every function here takes an optional `tenantId`, defaulting to `null` —
 * self-host call sites are unaffected by multi-tenancy (their rows all
 * carry `tenant_id IS NULL`). Cloud-mode call sites (from M12 on) pass the
 * authenticated tenant's id explicitly. `IS` rather than `=` in every WHERE
 * clause is deliberate — see migrations/0002_multi_tenant.sql's comment.
 */
export async function listWebsites(
  db: D1Database,
  tenantId: string | null = null
): Promise<WebsiteRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM websites WHERE tenant_id IS ?1 ORDER BY is_default DESC, name ASC")
    .bind(tenantId)
    .all<WebsiteRow>();
  return results;
}

export async function getWebsiteByDomain(
  db: D1Database,
  domain: string,
  tenantId: string | null = null
): Promise<WebsiteRow | null> {
  const row = await db
    .prepare("SELECT * FROM websites WHERE primary_domain = ?1 AND tenant_id IS ?2")
    .bind(domain, tenantId)
    .first<WebsiteRow>();
  return row ?? null;
}

export interface AddWebsiteInput {
  name: string;
  primaryDomain: string;
  isDefault?: boolean;
  gscSiteUrl?: string;
  ga4PropertyId?: string;
}

export async function addWebsite(
  db: D1Database,
  input: AddWebsiteInput,
  tenantId: string | null = null
): Promise<WebsiteRow> {
  const websiteId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO websites (website_id, name, primary_domain, is_default, gsc_site_url, ga4_property_id, tenant_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
    .bind(
      websiteId,
      input.name,
      input.primaryDomain,
      input.isDefault ? 1 : 0,
      input.gscSiteUrl ?? null,
      input.ga4PropertyId ?? null,
      tenantId
    )
    .run();

  const row = await getWebsiteByDomain(db, input.primaryDomain, tenantId);
  if (!row) {
    // Should be unreachable — we just inserted it — but D1 is a network
    // call, so don't silently return an invented row if it somehow fails.
    throw new Error(`failed to read back inserted website ${input.primaryDomain}`);
  }
  return row;
}
