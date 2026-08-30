// One-off verification, not part of the app: since neither data.ntsb.gov
// nor asias.faa.gov are reachable from this dev sandbox, this feeds the
// real sample data captured from working reference implementations
// (verbatim FAA CSV rows, a real saved NTSB CAROL case record) through a
// mocked fetch() to confirm the parsing/mapping logic actually works
// against real-shaped responses, not just that it typechecks.
//
// Run: node --experimental-strip-types scripts/test-source-parsers.ts

import { zipSync, strToU8 } from "fflate";

// --- Real FAA CSV sample (verbatim header + 2 rows, from
// aaronraimist/FAA-Preliminary-Accident-and-Incident-Data's merged CSV) ---
const FAA_CSV = `UPDATED,ENTRY_DATE,EVENT_LCL_DATE,EVENT_LCL_TIME,LOC_CITY_NAME,LOC_STATE_NAME,LOC_CNTRY_NAME,RMK_TEXT,EVENT_TYPE_DESC,FSDO_DESC,REGIST_NBR,FLT_NBR,ACFT_OPRTR,ACFT_MAKE_NAME,ACFT_MODEL_NAME,ACFT_MISSING_FLAG,ACFT_DMG_DESC,FLT_ACTIVITY,FLT_PHASE,FAR_PART,MAX_INJ_LVL,FATAL_FLAG,FLT_CRW_INJ_NONE,FLT_CRW_INJ_MINOR,FLT_CRW_INJ_SERIOUS,FLT_CRW_INJ_FATAL,FLT_CRW_INJ_UNK,CBN_CRW_INJ_NONE,CBN_CRW_INJ_MINOR,CBN_CRW_INJ_SERIOUS,CBN_CRW_INJ_FATAL,CBN_CRW_INJ_UNK,PAX_INJ_NONE,PAX_INJ_MINOR,PAX_INJ_SERIOUS,PAX_INJ_FATAL,PAX_INJ_UNK,GRND_INJ_NONE,GRND_INJ_MINOR,GRND_INJ_SERIOUS,GRND_INJ_FATAL,GRND_INJ_UNK
No,01-SEP-23,21-SEP-03,19:40:00Z,SAINT JOHNS,ARIZONA,UNITED STATES,"AIRCRAFT WRECKAGE LOCATED, SAINT JOHNS, AZ.",ACCIDENT,SCOTTSDALE FSDO,N927JL,,,BEECH,F33A,No,DESTROYED,PERSONAL,EN ROUTE (ENR),91.0,FATAL,Yes,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0
No,08-OCT-21,28-MAR-21,16:00:00Z,ONTARIO,OREGON,UNITED STATES,"AIRCRAFT GROUND LOOPED ON LANDING AFTER RIGHT BRAKE FAILURE, ONTARIO, OR (ONO)",ACCIDENT,HILLSBORO OR FSDO,N235X,,,MAULE,MX-7-235,No,SUBSTANTIAL,PERSONAL,LANDING (LDG),91.0,NONE,No,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0
`;

// --- Real NTSB CAROL sample case (verbatim, from
// Amineharrabi/NTSB_api's data/ntsb_2025_04.json, one record) ---
const NTSB_CASE = {
  cm_ntsbNum: "CEN25LA173",
  cm_eventDate: "2025-04-30T19:50:00Z",
  cm_city: "Duncan",
  cm_state: "OK",
  cm_country: "USA",
  cm_highestInjury: "None",
  cm_fatalInjuryCount: 0,
  cm_completionStatus: "In work",
  cm_vehicles: [{ make: "CESSNA", model: "180F", registrationNumber: "N2135Z", operatorName: "Prop Blast Aviation, LLC" }],
  prelimNarrative: "On April 30, 2025, about 1950 central daylight time, a Cessna 180F airplane, N2135Z, sustained substantial damage...",
};

// Mock global fetch per-source before importing (the modules read `fetch`
// at call time, not import time, so patching global.fetch first is enough).
let mockMode: "faa" | "ntsb" = "faa";
globalThis.fetch = (async (_url: string, _init?: RequestInit) => {
  if (mockMode === "faa") {
    return new Response(FAA_CSV, { status: 200 });
  }
  const zipped = zipSync({ "carol_export.json": strToU8(JSON.stringify([NTSB_CASE])) });
  return new Response(zipped, { status: 200 });
}) as typeof fetch;

const { fetchFaaSignals } = await import("../src/sources/faa.ts");
const { fetchNtsbSignals } = await import("../src/sources/ntsb.ts");

mockMode = "faa";
const faaSignals = await fetchFaaSignals();
console.log("--- FAA ---");
console.log(JSON.stringify(faaSignals, null, 2));
if (faaSignals.length !== 2) throw new Error(`expected 2 FAA signals, got ${faaSignals.length}`);
if (!faaSignals[0].title.includes("BEECH F33A")) throw new Error(`FAA title mapping looks wrong: ${faaSignals[0].title}`);
if (!faaSignals[0].url.startsWith("https://www.faa.gov/")) throw new Error("FAA url should point at faa.gov");

mockMode = "ntsb";
const ntsbSignals = await fetchNtsbSignals("2025-04-01", "2025-04-30");
console.log("--- NTSB ---");
console.log(JSON.stringify(ntsbSignals, null, 2));
if (ntsbSignals.length !== 1) throw new Error(`expected 1 NTSB signal, got ${ntsbSignals.length}`);
if (ntsbSignals[0].title !== "CESSNA 180F") throw new Error(`NTSB title mapping looks wrong: ${ntsbSignals[0].title}`);
if (!ntsbSignals[0].url.includes("CEN25LA173")) throw new Error("NTSB url should include the case number");

console.log("\nAll parser checks passed against real sample data.");
