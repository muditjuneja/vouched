// GDELT DOC 2.0 API — no key required, explicitly unrestricted-use license.
// Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
// Filtering on the AVIATION_INCIDENT GKG theme, last 1 day, most recent first.

export interface GdeltArticle {
  url: string;
  title: string;
  domain: string;
  seendate: string; // e.g. "20260830T213400Z"
  sourcecountry: string;
  language?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

const GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";

export async function fetchGdeltAviationSignals(): Promise<GdeltArticle[]> {
  const params = new URLSearchParams({
    query: "theme:AVIATION_INCIDENT",
    mode: "ArtList",
    format: "json",
    maxrecords: "250",
    timespan: "1d",
    sort: "DateDesc",
  });

  const res = await fetch(`${GDELT_ENDPOINT}?${params.toString()}`, {
    headers: { "User-Agent": "planecrashes-today-ingest/0.1 (prototype)" },
  });

  if (!res.ok) {
    throw new Error(`GDELT request failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as GdeltResponse;
  return body.articles ?? [];
}
