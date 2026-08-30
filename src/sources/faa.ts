// FAA preliminary accident/incident data — real implementation.
//
// This URL is a fixed Oracle APEX "Excel output" flow link — not a session
// export, a stable report ID — confirmed working in production for years
// by a GitHub Action that's been pulling it weekly since Aug 2021
// (github.com/aaronraimist/FAA-Preliminary-Accident-and-Incident-Data).
// The earlier "no stable URL" assessment was wrong about *this specific*
// link; general APEX exports usually are session-bound, this one apparently
// isn't. Column layout below is copied verbatim from that repo's merged
// CSV header, not guessed.

import type { NormalizedSignal } from "../types";

const FAA_PRELIM_CSV_URL =
  "https://www.asias.faa.gov/apex/f?p=100:93::FLOW_EXCEL_OUTPUT_R16070756597770675_en";

const COLUMNS = [
  "UPDATED", "ENTRY_DATE", "EVENT_LCL_DATE", "EVENT_LCL_TIME", "LOC_CITY_NAME", "LOC_STATE_NAME",
  "LOC_CNTRY_NAME", "RMK_TEXT", "EVENT_TYPE_DESC", "FSDO_DESC", "REGIST_NBR", "FLT_NBR", "ACFT_OPRTR",
  "ACFT_MAKE_NAME", "ACFT_MODEL_NAME", "ACFT_MISSING_FLAG", "ACFT_DMG_DESC", "FLT_ACTIVITY", "FLT_PHASE",
  "FAR_PART", "MAX_INJ_LVL", "FATAL_FLAG", "FLT_CRW_INJ_NONE", "FLT_CRW_INJ_MINOR", "FLT_CRW_INJ_SERIOUS",
  "FLT_CRW_INJ_FATAL", "FLT_CRW_INJ_UNK", "CBN_CRW_INJ_NONE", "CBN_CRW_INJ_MINOR", "CBN_CRW_INJ_SERIOUS",
  "CBN_CRW_INJ_FATAL", "CBN_CRW_INJ_UNK", "PAX_INJ_NONE", "PAX_INJ_MINOR", "PAX_INJ_SERIOUS", "PAX_INJ_FATAL",
  "PAX_INJ_UNK", "GRND_INJ_NONE", "GRND_INJ_MINOR", "GRND_INJ_SERIOUS", "GRND_INJ_FATAL", "GRND_INJ_UNK",
] as const;

type FaaRow = Record<(typeof COLUMNS)[number], string>;

/** Minimal RFC4180 CSV parser: quoted fields, embedded commas, "" escapes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }
  return rows;
}

export async function fetchFaaSignals(): Promise<NormalizedSignal[]> {
  const res = await fetch(FAA_PRELIM_CSV_URL, {
    headers: { "User-Agent": "planecrashes-today-ingest/0.1 (prototype)" },
  });
  if (!res.ok) {
    throw new Error(`FAA preliminary data request failed: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toUpperCase());
  const dataRows = rows.slice(1);

  return dataRows.map((cells): NormalizedSignal => {
    const row = {} as FaaRow;
    header.forEach((col, i) => {
      if ((COLUMNS as readonly string[]).includes(col)) {
        (row as Record<string, string>)[col] = cells[i] ?? "";
      }
    });

    const title =
      [row.EVENT_TYPE_DESC, [row.ACFT_MAKE_NAME, row.ACFT_MODEL_NAME].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" — ") +
      (row.LOC_CITY_NAME ? ` near ${row.LOC_CITY_NAME}${row.LOC_STATE_NAME ? `, ${row.LOC_STATE_NAME}` : ""}` : "");

    // No per-record FAA URL exists (it's a flat CSV export, not a database
    // with permalinks) — point at the real published-data page, with a
    // fragment built from distinguishing fields for our own dedup
    // uniqueness. Not a working deep link to this specific record.
    const dedupKey = [row.REGIST_NBR, row.EVENT_LCL_DATE, row.EVENT_LCL_TIME, row.LOC_CITY_NAME]
      .filter(Boolean)
      .join("-");

    return {
      url: `https://www.faa.gov/data_research/accident_incident/preliminary_data#${encodeURIComponent(dedupKey || crypto.randomUUID())}`,
      title: title || `FAA preliminary report — ${row.LOC_CITY_NAME ?? "unknown location"}`,
      domain: "faa.gov",
      sourceCountry: row.LOC_CNTRY_NAME === "UNITED STATES" ? "US" : (row.LOC_CNTRY_NAME ?? null),
      language: "en",
      seenAt: row.ENTRY_DATE || row.EVENT_LCL_DATE,
      raw: row,
    };
  });
}
