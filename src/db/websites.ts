export interface WebsiteRow {
  website_id: string;
  name: string;
  primary_domain: string;
  is_default: number;
  gsc_site_url: string | null;
  ga4_property_id: string | null;
  created_at: string;
}

export async function listWebsites(db: D1Database): Promise<WebsiteRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM websites ORDER BY is_default DESC, name ASC")
    .all<WebsiteRow>();
  return results;
}

export async function getWebsiteByDomain(
  db: D1Database,
  domain: string
): Promise<WebsiteRow | null> {
  const row = await db
    .prepare("SELECT * FROM websites WHERE primary_domain = ?1")
    .bind(domain)
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

export async function addWebsite(db: D1Database, input: AddWebsiteInput): Promise<WebsiteRow> {
  const websiteId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO websites (website_id, name, primary_domain, is_default, gsc_site_url, ga4_property_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(
      websiteId,
      input.name,
      input.primaryDomain,
      input.isDefault ? 1 : 0,
      input.gscSiteUrl ?? null,
      input.ga4PropertyId ?? null
    )
    .run();

  const row = await getWebsiteByDomain(db, input.primaryDomain);
  if (!row) {
    // Should be unreachable — we just inserted it — but D1 is a network
    // call, so don't silently return an invented row if it somehow fails.
    throw new Error(`failed to read back inserted website ${input.primaryDomain}`);
  }
  return row;
}
