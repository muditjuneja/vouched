// FAA preliminary accident/incident data — NOT IMPLEMENTED. Flagging why.
//
// This is served through an Oracle APEX interactive report on
// asias.faa.gov (https://www.asias.faa.gov/apex/f?p=100:93:::NO:::), not a
// stable REST/CSV URL — APEX export links are session/report-instance
// specific, so there's no clean endpoint to hardcode a fetch() against.
// The FAA's own page (faa.gov/data_research/accident_incident/preliminary_data)
// says a downloadable CSV exists but doesn't publish a fixed URL for it.
//
// A community scraper already exists and is the fastest real path in:
// https://github.com/aaronraimist/FAA-Preliminary-Accident-and-Incident-Data
// (has been scraping this since Aug 2021) — read its scraper code to get
// the actual export mechanism rather than re-deriving it against the APEX
// UI blind.
//
// Priority note: per the sourcing research this was meant to be the
// fastest *official* US confirmation layer (often faster than NTSB CAROL),
// so it's worth doing properly rather than half-implementing against a
// guessed URL that silently breaks the first time APEX changes a session
// parameter.

export {};
