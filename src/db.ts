import type { Incident, IncidentSourceRef, NormalizedSignal, RawSignalRow } from "./types";
import type { TriageResult } from "./llm";

export type { Incident } from "./types";

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

/** Recent incidents to hand the LLM as dedup candidates — id/title/location only. */
export async function listCandidateIncidents(db: D1Database, sinceDays = 7) {
  const { results } = await db
    .prepare(
      `SELECT id, title, location, occurred_at FROM incidents
       WHERE COALESCE(occurred_at, first_seen_at) >= datetime('now', ?)
       ORDER BY COALESCE(occurred_at, first_seen_at) DESC
       LIMIT 30`
    )
    .bind(`-${sinceDays} days`)
    .all<{ id: number; title: string; location: string | null; occurred_at: string | null }>();
  return results;
}

/**
 * Insert raw ingestion signals for one source, skipping ones already seen
 * (unique on url). Returns the ids of newly inserted rows so the caller can
 * enqueue them for triage — this is the producer side of the pipeline.
 */
export async function upsertRawSignals(
  db: D1Database,
  source: string,
  signals: NormalizedSignal[]
): Promise<{ inserted: number; skipped: number; insertedIds: number[] }> {
  if (signals.length === 0) return { inserted: 0, skipped: 0, insertedIds: [] };

  const stmt = db.prepare(
    `INSERT INTO raw_signals (source, url, title, domain, source_country, language, seen_at, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(url) DO NOTHING
     RETURNING id`
  );

  const batch = signals.map((s) =>
    stmt.bind(source, s.url, s.title, s.domain, s.sourceCountry, s.language, s.seenAt, JSON.stringify(s.raw))
  );

  const results = await db.batch<{ id: number }>(batch);
  const insertedIds: number[] = [];
  for (const r of results) {
    if (r.results.length > 0) insertedIds.push(r.results[0].id);
  }
  return { inserted: insertedIds.length, skipped: signals.length - insertedIds.length, insertedIds };
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

export async function getRawSignal(db: D1Database, id: number): Promise<RawSignalRow | null> {
  return db.prepare(`SELECT * FROM raw_signals WHERE id = ?`).bind(id).first<RawSignalRow>();
}

/**
 * Apply an LLM triage decision: create a new incident, merge into an
 * existing one, or (if not a real aviation incident) just mark the signal
 * triaged with no incident attached. Always marks the signal triaged so a
 * redelivered queue message is a no-op (idempotent on triaged_at).
 */
export async function applyTriageResult(
  db: D1Database,
  signal: RawSignalRow,
  result: TriageResult
): Promise<{ action: "filtered" | "merged" | "created"; incidentId: number | null }> {
  if (signal.triaged_at) {
    // Already processed (e.g. redelivered queue message) — no-op.
    return { action: signal.incident_id ? "merged" : "filtered", incidentId: signal.incident_id };
  }

  if (!result.is_aviation_incident) {
    await db
      .prepare(`UPDATE raw_signals SET triaged_at = datetime('now') WHERE id = ?`)
      .bind(signal.id)
      .run();
    return { action: "filtered", incidentId: null };
  }

  const sourceRef: IncidentSourceRef = { name: signal.domain ?? signal.source, url: signal.url, type: "news" };

  if (result.matches_existing_incident_id) {
    const existing = await getIncident(db, result.matches_existing_incident_id);
    if (existing) {
      const sources: IncidentSourceRef[] = JSON.parse(existing.sources);
      if (!sources.some((s) => s.url === sourceRef.url)) sources.push(sourceRef);
      await db
        .prepare(
          `UPDATE incidents SET sources = ?, updated_at = datetime('now') WHERE id = ?`
        )
        .bind(JSON.stringify(sources), existing.id)
        .run();
      await db
        .prepare(`UPDATE raw_signals SET triaged_at = datetime('now'), incident_id = ? WHERE id = ?`)
        .bind(existing.id, signal.id)
        .run();
      return { action: "merged", incidentId: existing.id };
    }
    // Fall through to "create new" if the candidate id the model picked no longer resolves.
  }

  const insert = await db
    .prepare(
      `INSERT INTO incidents
        (status, title, summary, location, country, aircraft_type, operator, flight_number,
         fatalities, injuries, occurred_at, first_seen_at, sources)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
    .bind(
      result.status,
      result.title,
      result.summary,
      result.location,
      result.country,
      result.aircraft_type,
      result.operator,
      result.flight_number,
      result.fatalities,
      result.injuries,
      result.occurred_at,
      signal.seen_at,
      JSON.stringify([sourceRef])
    )
    .first<{ id: number }>();

  const incidentId = insert!.id;
  await db
    .prepare(`UPDATE raw_signals SET triaged_at = datetime('now'), incident_id = ? WHERE id = ?`)
    .bind(incidentId, signal.id)
    .run();

  return { action: "created", incidentId };
}
