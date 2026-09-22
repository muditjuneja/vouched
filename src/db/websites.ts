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
 * Every function here takes an optional `tenantId`, defaulting to `null`:
 * self-host call sites are unaffected by multi-tenancy (their rows all
 * carry `tenant_id IS NULL`). Cloud-mode call sites (from M12 on) pass the
 * authenticated tenant's id explicitly. `IS` rather than `=` in every WHERE
 * clause is deliberate, see migrations/0002_multi_tenant.sql's comment.
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

export async function getWebsiteById(
  db: D1Database,
  websiteId: string,
  tenantId: string | null = null
): Promise<WebsiteRow | null> {
  const row = await db
    .prepare("SELECT * FROM websites WHERE website_id = ?1 AND tenant_id IS ?2")
    .bind(websiteId, tenantId)
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
    // Should be unreachable (we just inserted it), but D1 is a network
    // call, so don't silently return an invented row if it somehow fails.
    throw new Error(`failed to read back inserted website ${input.primaryDomain}`);
  }
  return row;
}

export interface UpdateWebsiteInput {
  name?: string;
  primaryDomain?: string;
  /** Nullable columns: `null` here means "clear it", the field being absent entirely means "leave it alone". */
  gscSiteUrl?: string | null;
  ga4PropertyId?: string | null;
}

/**
 * Partial update: only fields present in `input` are touched. `tenant_id IS
 * ?` in the WHERE clause is the whole security story here: a tenant can
 * never touch another tenant's row by id-guessing, since the update simply
 * matches zero rows instead.
 */
export async function updateWebsite(
  db: D1Database,
  websiteId: string,
  input: UpdateWebsiteInput,
  tenantId: string | null = null
): Promise<WebsiteRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) {
    sets.push(`name = ?${values.length + 1}`);
    values.push(input.name);
  }
  if (input.primaryDomain !== undefined) {
    sets.push(`primary_domain = ?${values.length + 1}`);
    values.push(input.primaryDomain);
  }
  if (input.gscSiteUrl !== undefined) {
    sets.push(`gsc_site_url = ?${values.length + 1}`);
    values.push(input.gscSiteUrl);
  }
  if (input.ga4PropertyId !== undefined) {
    sets.push(`ga4_property_id = ?${values.length + 1}`);
    values.push(input.ga4PropertyId);
  }
  if (sets.length === 0) return getWebsiteById(db, websiteId, tenantId);

  const websiteIdParam = values.length + 1;
  const tenantIdParam = values.length + 2;
  await db
    .prepare(`UPDATE websites SET ${sets.join(", ")} WHERE website_id = ?${websiteIdParam} AND tenant_id IS ?${tenantIdParam}`)
    .bind(...values, websiteId, tenantId)
    .run();

  return getWebsiteById(db, websiteId, tenantId);
}

/** True only if a row actually existed and belonged to this tenant. */
export async function deleteWebsite(db: D1Database, websiteId: string, tenantId: string | null = null): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM websites WHERE website_id = ?1 AND tenant_id IS ?2")
    .bind(websiteId, tenantId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
