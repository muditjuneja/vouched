// NTSB CAROL — NOT IMPLEMENTED. Flagging why rather than shipping a guess.
//
// The research round found a real REST API at data.ntsb.gov (/api/v1/cases,
// /api/v1/cases/search, /api/v1/stats), no key required, public-domain data.
// But data.ntsb.gov was unreachable from this sandbox's network egress
// allowlist, so the exact request schema for /cases/search couldn't be
// verified here — and independent sources describe it as a genuinely
// complex filter DSL ("QueryGroups"), not a simple query-param search;
// third-party wrapper libraries exist specifically to paper over that.
// Writing a guessed request body would be worse than nothing — it would
// look wired up while silently failing or, worse, silently returning
// nothing.
//
// Before implementing:
//   1. Fetch https://data.ntsb.gov/carol-main-public/api-documentation
//      directly (works fine outside this sandbox) and confirm the actual
//      /api/v1/cases/search request/response shape.
//   2. Or vendor a known-working reference implementation — the search
//      turned up https://github.com/Amineharrabi/NTSB_api and a
//      `NTSB-api` PyPI package that already solved this; port the request
//      shape from one of those rather than re-deriving it blind.
//
// Priority note: NTSB is Layer 2 (authoritative, slow — 12-24mo to final
// report) per the sourcing research, not a breaking-signal source, so this
// isn't blocking the ingestion pipeline working end-to-end without it.

export {};
