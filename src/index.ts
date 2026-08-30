import { Hono } from "hono";
import { fetchGdeltSignals } from "./sources/gdelt";
import { fetchNewsdataSignals } from "./sources/newsdata";
import { fetchWikidataBackfill } from "./sources/wikidata";
import { fetchNtsbSignals } from "./sources/ntsb";
import { fetchFaaSignals } from "./sources/faa";
import {
  countRawSignals,
  getIncident,
  listRecentIncidents,
  listRecentRawSignals,
  upsertRawSignals,
} from "./db";
import { renderHome, renderIncident, renderSignals } from "./render";
import { archiveRawPayload } from "./archive";
import { triageRawSignal } from "./triage";
import type { NormalizedSignal } from "./types";

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ARCHIVE: R2Bucket;
  INGEST_QUEUE: Queue<TriageMessage>;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
  NEWSDATA_API_KEY?: string;
}

interface TriageMessage {
  rawSignalId: number;
}

type FastSource = "gdelt" | "newsdata";
type SlowSource = "ntsb" | "faa";

const FAST_SOURCES: FastSource[] = ["gdelt", "newsdata"];
const SLOW_SOURCES: SlowSource[] = ["ntsb", "faa"];

const HOME_CACHE_KEY = "home:v1";
const HOME_CACHE_TTL_SECONDS = 60; // freshness vs. read load — short is fine, ingestion is minutes-grained anyway

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const cached = await c.env.CACHE.get(HOME_CACHE_KEY);
  if (cached) return c.html(cached);

  const incidents = await listRecentIncidents(c.env.DB);
  const html = renderHome(incidents).toString();
  c.executionCtx.waitUntil(c.env.CACHE.put(HOME_CACHE_KEY, html, { expirationTtl: HOME_CACHE_TTL_SECONDS }));
  return c.html(html);
});

app.get("/incident/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const inc = await getIncident(c.env.DB, id);
  if (!inc) return c.notFound();
  return c.html(renderIncident(inc));
});

// Debug-only for now — verifies the pipeline is actually landing/triaging
// rows. Remove or auth-gate before this is a public site.
app.get("/debug/signals", async (c) => {
  const [count, rows] = await Promise.all([countRawSignals(c.env.DB), listRecentRawSignals(c.env.DB, 25)]);
  return c.html(renderSignals(count, rows));
});

// Manual triggers for local dev (`wrangler dev` doesn't fire cron on its own
// without --test-scheduled). Same code paths the scheduled handler uses.
// NTSB takes an optional date range (defaults to the last 7 days); the rest
// ignore query params.
app.post("/debug/ingest/:source", async (c) => {
  const source = c.req.param("source");
  if (!isKnownSource(source)) {
    return c.json({ error: `unknown source '${source}'` }, 400);
  }
  const result = await runIngest(c.env, source, {
    ntsbStartDate: c.req.query("start"),
    ntsbEndDate: c.req.query("end"),
  });
  return c.json(result);
});

app.post("/debug/triage/:rawSignalId", async (c) => {
  const rawSignalId = Number(c.req.param("rawSignalId"));
  const result = await triageRawSignal(c.env, rawSignalId);
  return c.json(result);
});

// One-off historical backfill, not on the cron schedule (Wikidata lags real
// events by days-to-weeks — it's for the archive, not breaking signal).
app.post("/admin/backfill/wikidata", async (c) => {
  const signals = await fetchWikidataBackfill();
  c.executionCtx.waitUntil(archiveRawPayload(c.env.ARCHIVE, "wikidata_backfill", signals));
  const result = await upsertRawSignals(c.env.DB, "wikidata_backfill", signals);
  // Deliberately not enqueued for LLM triage — backfill volume would be
  // expensive to triage one-by-one; promote these directly or batch-triage
  // once the schema/mapping is validated against real rows.
  return c.json({ source: "wikidata_backfill", fetched: signals.length, ...result });
});

function isKnownSource(s: string): s is FastSource | SlowSource {
  return (FAST_SOURCES as string[]).includes(s) || (SLOW_SOURCES as string[]).includes(s);
}

async function runIngest(
  env: Env,
  source: FastSource | SlowSource,
  opts: { ntsbStartDate?: string; ntsbEndDate?: string } = {}
) {
  let signals: NormalizedSignal[];

  switch (source) {
    case "gdelt":
      signals = await fetchGdeltSignals();
      break;
    case "newsdata":
      if (!env.NEWSDATA_API_KEY) {
        return { source, skipped: true, reason: "NEWSDATA_API_KEY not set" };
      }
      signals = await fetchNewsdataSignals(env.NEWSDATA_API_KEY);
      break;
    case "ntsb": {
      // Default window: last 7 days, inclusive — deliberately overlaps
      // previous runs (dedup on url means re-seeing a case is a no-op) so
      // a missed/failed run doesn't silently drop cases.
      const end = opts.ntsbEndDate ?? new Date().toISOString().slice(0, 10);
      const start = opts.ntsbStartDate ?? new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
      signals = await fetchNtsbSignals(start, end);
      break;
    }
    case "faa":
      signals = await fetchFaaSignals();
      break;
  }

  // Archive the raw pull before touching D1 — durability insurance even if
  // the D1 write or triage step below fails. Matters most for FAA, whose
  // own rolling window deletes history we didn't save ourselves.
  await archiveRawPayload(env.ARCHIVE, source, signals);

  const result = await upsertRawSignals(env.DB, source, signals);

  if (result.insertedIds.length > 0) {
    await env.INGEST_QUEUE.sendBatch(result.insertedIds.map((rawSignalId) => ({ body: { rawSignalId } })));
  }

  return { source, fetched: signals.length, ...result };
}

async function runIngestBatch(env: Env, sources: (FastSource | SlowSource)[]) {
  for (const source of sources) {
    try {
      const r = await runIngest(env, source);
      console.log(`ingest ${source}:`, JSON.stringify(r));
    } catch (err) {
      // One source failing shouldn't take the others down with it.
      console.error(`ingest ${source} failed:`, err);
    }
  }
}

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Two cron patterns share this handler (see wrangler.jsonc) — the fast
    // breaking-signal sources run every 15min, the slower/heavier
    // authoritative sources (a POST+unzip, and a full CSV pull) hourly.
    const sources = event.cron === "0 * * * *" ? SLOW_SOURCES : FAST_SOURCES;
    ctx.waitUntil(runIngestBatch(env, sources));
  },

  async queue(batch: MessageBatch<TriageMessage>, env: Env) {
    for (const msg of batch.messages) {
      try {
        const result = await triageRawSignal(env, msg.body.rawSignalId);
        console.log(`triage ${msg.body.rawSignalId}:`, JSON.stringify(result));
        msg.ack();
      } catch (err) {
        console.error(`triage ${msg.body.rawSignalId} failed:`, err);
        msg.retry();
      }
    }
    // On republish, purge the home cache so newly-triaged incidents show up
    // without waiting for the TTL — cheap and simple vs. surgical invalidation.
    await env.CACHE.delete(HOME_CACHE_KEY);
  },
};
