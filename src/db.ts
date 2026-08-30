import type { GdeltArticle } from "./gdelt";

export interface Incident {
  id: number;
  status: "unconfirmed" | "confirmed_no_fatalities" | "confirmed_fatalities" | "investigating";
  title: string;
  summary: string | null;
  location: string | null;
  country: string | null;
  aircraft_type: string | null;
  operator: string | null;
  fatalities: number | null;
  injuries: number | null;
  occurred_at: string | null;
  first_seen_at: string;
  sources: string; // JSON-encoded array, parse at render time
}

export async function listRecentIncidents(db: D1Database, limit = 50): Promise<Incident[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM incidents
       ORDER BY COALESCE(occurred_at, first_seen_at) DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<Incident>();
  return results;
}

export async function getIncident(db: D1Database, id: number): Promise<Incident | null> {
  return db.prepare(`SELECT * FROM incidents WHERE id = ?`).bind(id).first<Incident>();
}

/** Insert raw ingestion signals, skipping ones already seen (unique on url). */
export async function upsertRawSignals(
  db: D1Database,
  source: string,
  articles: GdeltArticle[]
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  // D1 batch keeps this to one round-trip instead of N.
  const stmt = db.prepare(
    `INSERT INTO raw_signals (source, url, title, domain, source_country, language, seen_at, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(url) DO NOTHING`
  );

  const batch = articles.map((a) =>
    stmt.bind(source, a.url, a.title, a.domain, a.sourcecountry, a.language ?? null, a.seendate, JSON.stringify(a))
  );

  if (batch.length === 0) return { inserted: 0, skipped: 0 };

  const results = await db.batch(batch);
  for (const r of results) {
    if (r.meta.changes > 0) inserted++;
    else skipped++;
  }
  return { inserted, skipped };
}

export async function countRawSignals(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) as n FROM raw_signals`).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listRecentRawSignals(db: D1Database, limit = 50) {
  const { results } = await db
    .prepare(`SELECT * FROM raw_signals ORDER BY seen_at DESC LIMIT ?`)
    .bind(limit)
    .all();
  return results;
}
