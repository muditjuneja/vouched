// NewsData.io — chosen in the sourcing research as a hyperlocal-reach
// complement to GDELT: 95,000+ sources across 206 countries, built for
// structured querying (not full-text redistribution), which matches our
// facts+metadata+link-back model. Free tier: 200 credits/day (~2,000
// articles). Docs: https://newsdata.io/documentation
//
// Requires the NEWSDATA_API_KEY secret. If it's not set, ingestion for this
// source is skipped (not a hard failure) — GDELT alone still runs.

import type { NormalizedSignal } from "../types";

interface NewsDataArticle {
  link: string;
  title: string;
  source_id: string;
  pubDate: string; // "YYYY-MM-DD HH:MM:SS"
  language: string;
  country: string[];
}

interface NewsDataResponse {
  status: string;
  results?: NewsDataArticle[];
}

const NEWSDATA_ENDPOINT = "https://newsdata.io/api/1/news";

export async function fetchNewsdataSignals(apiKey: string): Promise<NormalizedSignal[]> {
  const params = new URLSearchParams({
    apikey: apiKey,
    // Broad net on purpose — the LLM triage step filters false positives,
    // this just needs to catch anything plausibly aviation-related.
    q: "plane crash OR aircraft crash OR emergency landing OR aviation accident",
    language: "en", // start English-only; widen once multi-language triage is validated
  });

  const res = await fetch(`${NEWSDATA_ENDPOINT}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`NewsData.io request failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as NewsDataResponse;
  if (body.status !== "success") {
    throw new Error(`NewsData.io returned non-success status: ${JSON.stringify(body).slice(0, 200)}`);
  }

  return (body.results ?? []).map(
    (a): NormalizedSignal => ({
      url: a.link,
      title: a.title,
      domain: a.source_id ?? null,
      sourceCountry: a.country?.[0] ?? null,
      language: a.language ?? null,
      seenAt: a.pubDate,
      raw: a,
    })
  );
}
