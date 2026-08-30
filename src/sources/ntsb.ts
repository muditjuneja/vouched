// NTSB CAROL — real implementation, ported from a working reference
// (https://github.com/Amineharrabi/NTSB_api's server-side ntsb_client.py,
// which this session verified by reading its actual source — the endpoint
// data.ntsb.gov was unreachable from this sandbox to confirm independently,
// but the payload shape below is copied from working code, not guessed).
//
// The public CAROL UI POSTs a "FileExport" request and gets back a ZIP
// containing one JSON file — an array of case records. Confirmed against
// a real saved sample response (data/ntsb_2025_04.json in that repo) for
// the field names used below (cm_ntsbNum, cm_eventDate, cm_vehicles[0]...).
//
// No confirmed direct per-case deep-link URL exists publicly (searched;
// only found a pattern for /sr-details/ safety-recommendation pages, not
// accident case summaries) — so the "source" URL points at the official
// CAROL search UI with the case number embedded as a query param for our
// own dedup uniqueness, not a verified working deep link. Update this if
// a real case-summary URL pattern gets confirmed later.

import { unzipSync, strFromU8 } from "fflate";
import type { NormalizedSignal } from "../types";

const CAROL_ENDPOINT = "https://data.ntsb.gov/carol-main-public/api/Query/FileExport";

interface NtsbVehicle {
  make?: string;
  model?: string;
  registrationNumber?: string;
  operatorName?: string;
}

interface NtsbCase {
  cm_ntsbNum: string;
  cm_eventDate: string; // ISO
  cm_city: string | null;
  cm_state: string | null;
  cm_country: string | null;
  cm_highestInjury: string | null;
  cm_fatalInjuryCount: number | null;
  cm_completionStatus: string | null;
  cm_vehicles?: NtsbVehicle[];
  prelimNarrative?: string | null;
  factualNarrative?: string | null;
  analysisNarrative?: string | null;
}

function buildDateRangePayload(startDate: string, endDate: string, mode = "Aviation") {
  const dateRule = (columns: string[], operator: string, value: string, fieldName: string, displayText: string) => ({
    RuleType: "Simple",
    Values: [value],
    Columns: columns,
    Operator: operator,
    overrideColumn: "",
    selectedOption: {
      FieldName: fieldName,
      DisplayText: displayText,
      Columns: columns,
      Selectable: true,
      InputType: "Date",
      RuleType: 0,
      Options: null,
      TargetCollection: "cases",
      UnderDevelopment: true,
    },
  });

  return {
    QueryGroups: [
      {
        QueryRules: [
          dateRule(["Event.EventDate"], "is on or after", startDate, "EventDate", "Event date"),
          dateRule(["Event.EventDate"], "is on or before", endDate, "EventDate", "Event date"),
          {
            RuleType: "Simple",
            Values: [mode],
            Columns: ["Event.Mode"],
            Operator: "is",
            overrideColumn: "",
            selectedOption: {
              FieldName: "Mode",
              DisplayText: "Investigation mode",
              Columns: ["Event.Mode"],
              Selectable: true,
              InputType: "Dropdown",
              RuleType: 0,
              Options: null,
              TargetCollection: "cases",
              UnderDevelopment: true,
            },
          },
        ],
        AndOr: "and",
        inLastSearch: false,
        editedSinceLastSearch: false,
      },
    ],
    AndOr: "and",
    TargetCollection: "cases",
    ExportFormat: "data",
    SessionId: 227230, // matches the reference implementation; unclear if this needs to be a live session
    ResultSetSize: 500,
    SortDescending: true,
  };
}

/** Fetch NTSB aviation cases with an event date in [startDate, endDate] (YYYY-MM-DD, inclusive). */
export async function fetchNtsbSignals(startDate: string, endDate: string): Promise<NormalizedSignal[]> {
  const res = await fetch(CAROL_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      Origin: "https://data.ntsb.gov",
      "User-Agent": "planecrashes-today-ingest/0.1 (prototype)",
    },
    body: JSON.stringify(buildDateRangePayload(startDate, endDate)),
  });

  if (!res.ok) {
    throw new Error(`NTSB CAROL request failed: ${res.status} ${res.statusText}`);
  }

  const zipBytes = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(zipBytes);
  const jsonEntry = Object.entries(files).find(([name]) => name.toLowerCase().endsWith(".json"));
  if (!jsonEntry) {
    throw new Error(`NTSB CAROL response ZIP had no .json entry (entries: ${Object.keys(files).join(", ")})`);
  }

  const cases = JSON.parse(strFromU8(jsonEntry[1])) as NtsbCase[];
  return cases.map(caseToSignal);
}

function caseToSignal(c: NtsbCase): NormalizedSignal {
  const vehicle = c.cm_vehicles?.[0];
  const narrative = c.prelimNarrative ?? c.factualNarrative ?? c.analysisNarrative ?? null;

  return {
    // Not a confirmed deep link — see file header comment. Unique per case,
    // on the real NTSB domain, points a curious reader at the right tool.
    url: `https://data.ntsb.gov/carol-main-public/?ntsbNum=${encodeURIComponent(c.cm_ntsbNum)}`,
    title: [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || `NTSB case ${c.cm_ntsbNum}`,
    domain: "data.ntsb.gov",
    sourceCountry: c.cm_country,
    language: "en",
    seenAt: c.cm_eventDate,
    raw: { ...c, _narrative_excerpt: narrative?.slice(0, 500) ?? null },
  };
}
