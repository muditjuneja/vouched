// Shared shapes across ingestion sources and the triage pipeline.

/** What every source module normalizes its API-specific response into. */
export interface NormalizedSignal {
  url: string;
  title: string;
  domain: string | null;
  sourceCountry: string | null;
  language: string | null;
  seenAt: string; // ISO 8601 where possible; source-native format otherwise
  raw: unknown; // full source payload, kept for later triage/debugging
}

export type IncidentStatus =
  | "unconfirmed"
  | "confirmed_no_fatalities"
  | "confirmed_fatalities"
  | "investigating";

export interface Incident {
  id: number;
  status: IncidentStatus;
  title: string;
  summary: string | null;
  location: string | null;
  country: string | null;
  aircraft_type: string | null;
  operator: string | null;
  flight_number: string | null;
  fatalities: number | null;
  injuries: number | null;
  occurred_at: string | null;
  first_seen_at: string;
  updated_at: string;
  sources: string; // JSON-encoded array of {name,url,type}, parse at render time
}

export interface IncidentSourceRef {
  name: string;
  url: string;
  type: string; // 'news' | 'official' | ...
}

export interface RawSignalRow {
  id: number;
  source: string;
  url: string;
  title: string;
  domain: string | null;
  source_country: string | null;
  language: string | null;
  seen_at: string;
  raw_json: string;
  triaged_at: string | null;
  incident_id: number | null;
  created_at: string;
}
