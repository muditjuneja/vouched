// Wikidata SPARQL — CC0, zero licensing risk, well-established stable
// endpoint. Used for backfilling the historical archive, not live polling
// (Wikidata lags days-to-weeks behind a fresh event as editors add
// structured data). Triggered manually via POST /admin/backfill/wikidata,
// not on the cron schedule.

import type { NormalizedSignal } from "../types";

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

// P31 instance-of aviation accident/incident (Q744913), with basic fields.
// Kept intentionally simple for v1 — widen the WHERE clause once this is
// validated against real output (e.g. add operator/aircraft type via P137/P137
// once field mappings are confirmed against a few real rows).
const QUERY = `
SELECT ?item ?itemLabel ?date ?locationLabel ?fatalities WHERE {
  ?item wdt:P31/wdt:P279* wd:Q744913.
  OPTIONAL { ?item wdt:P585 ?date. }
  OPTIONAL { ?item wdt:P276 ?location. }
  OPTIONAL { ?item wdt:P1120 ?fatalities. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?date)
LIMIT 500
`;

interface SparqlBinding {
  item: { value: string };
  itemLabel: { value: string };
  date?: { value: string };
  locationLabel?: { value: string };
  fatalities?: { value: string };
}

interface SparqlResponse {
  results: { bindings: SparqlBinding[] };
}

export async function fetchWikidataBackfill(): Promise<NormalizedSignal[]> {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(QUERY)}&format=json`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      // Wikimedia etiquette: identify the client.
      "User-Agent": "planecrashes-today-backfill/0.1 (prototype; contact: set-a-real-contact@example.com)",
    },
  });

  if (!res.ok) {
    throw new Error(`Wikidata SPARQL request failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as SparqlResponse;
  return body.results.bindings.map(
    (b): NormalizedSignal => ({
      url: b.item.value, // Wikidata entity URI — resolves to a browsable page
      title: b.itemLabel.value,
      domain: "wikidata.org",
      sourceCountry: null,
      language: "en",
      seenAt: b.date?.value ?? new Date().toISOString(),
      raw: b,
    })
  );
}
