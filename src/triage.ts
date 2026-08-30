import { getRawSignal, listCandidateIncidents, applyTriageResult } from "./db";
import { triageWithLLM } from "./llm";

export interface TriageEnv {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
}

/**
 * Runs one raw_signal through LLM triage and applies the result to D1.
 * Idempotent: a signal that's already triaged (e.g. a redelivered queue
 * message) is a no-op via applyTriageResult's guard.
 */
export async function triageRawSignal(env: TriageEnv, rawSignalId: number) {
  const signal = await getRawSignal(env.DB, rawSignalId);
  if (!signal) throw new Error(`raw_signal ${rawSignalId} not found`);
  if (signal.triaged_at) return { action: "already-triaged" as const, incidentId: signal.incident_id };

  const candidates = await listCandidateIncidents(env.DB);

  const result = await triageWithLLM(env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL, {
    signal: {
      title: signal.title,
      domain: signal.domain,
      url: signal.url,
      source: signal.source,
      seen_at: signal.seen_at,
    },
    candidates,
  });

  return applyTriageResult(env.DB, signal, result);
}
