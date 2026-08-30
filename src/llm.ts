// OpenRouter (OpenAI-compatible) client for the triage step.
// Docs: https://openrouter.ai/docs/api_reference/overview
// Requires the OPENROUTER_API_KEY secret: `wrangler secret put OPENROUTER_API_KEY`.

export type IncidentStatus =
  | "unconfirmed"
  | "confirmed_no_fatalities"
  | "confirmed_fatalities"
  | "investigating";

export interface TriageInput {
  signal: {
    title: string;
    domain: string | null;
    url: string;
    source: string;
    seen_at: string;
  };
  /** Recent open incidents the model can match this signal against, to dedup. */
  candidates: { id: number; title: string; location: string | null; occurred_at: string | null }[];
}

export interface TriageResult {
  is_aviation_incident: boolean;
  matches_existing_incident_id: number | null;
  title: string;
  summary: string;
  status: IncidentStatus;
  location: string | null;
  country: string | null;
  aircraft_type: string | null;
  operator: string | null;
  flight_number: string | null;
  fatalities: number | null;
  injuries: number | null;
  occurred_at: string | null;
}

const SYSTEM_PROMPT = `You triage raw news signals for planecrashes.today, a live aviation-incident tracker.

Given one signal (a headline/link a monitoring feed picked up) and a short list of
recently-open incidents, decide:
1. Is this actually about a real aviation incident (crash, emergency landing, runway
   excursion, ditching, etc.)? Reject false positives: movies/TV, "airplane mode",
   anniversary retrospectives of old events, unrelated metaphor use, video games.
2. If real, does it match one of the candidate incidents (same event, different
   article) or is it a new, distinct incident?
3. Extract whatever structured facts the headline/title actually supports. Leave a
   field null rather than guessing — a headline alone often won't have all fields.

Tone matters: this product deliberately avoids sensationalism. Write "summary" in a
dispassionate, factual register (like an incident-report abstract, not a news
headline) — no dramatic language, no speculation stated as fact.

status must be one of: "unconfirmed" (report exists, nothing else verified),
"confirmed_no_fatalities", "confirmed_fatalities", "investigating" (official
investigation is known to be underway). Default to "unconfirmed" unless the
headline itself clearly states otherwise — do not infer severity you're not told.

Respond with ONLY a JSON object matching this exact shape, no prose:
{
  "is_aviation_incident": boolean,
  "matches_existing_incident_id": number | null,
  "title": string,
  "summary": string,
  "status": "unconfirmed" | "confirmed_no_fatalities" | "confirmed_fatalities" | "investigating",
  "location": string | null,
  "country": string | null,
  "aircraft_type": string | null,
  "operator": string | null,
  "flight_number": string | null,
  "fatalities": number | null,
  "injuries": number | null,
  "occurred_at": string | null
}`;

export async function triageWithLLM(
  apiKey: string,
  model: string,
  input: TriageInput
): Promise<TriageResult> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Optional but recommended by OpenRouter for attribution/rankings.
      "HTTP-Referer": "https://planecrashes.today",
      "X-Title": "planecrashes.today ingest triage",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter request failed: ${res.status} ${res.statusText} — ${await res.text()}`);
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter response had no message content");

  let parsed: TriageResult;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`OpenRouter response wasn't valid JSON: ${content.slice(0, 200)}`);
  }
  return parsed;
}
