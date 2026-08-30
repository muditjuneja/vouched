import { Hono } from "hono";
import { fetchGdeltAviationSignals } from "./gdelt";
import { countRawSignals, getIncident, listRecentIncidents, listRecentRawSignals, upsertRawSignals } from "./db";
import { renderHome, renderIncident, renderSignals } from "./render";

export interface Env {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const incidents = await listRecentIncidents(c.env.DB);
  return c.html(renderHome(incidents));
});

app.get("/incident/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const inc = await getIncident(c.env.DB, id);
  if (!inc) return c.notFound();
  return c.html(renderIncident(inc));
});

// Debug-only for now — verifies the cron pipeline is actually landing rows.
// Remove or auth-gate before this is a public site.
app.get("/debug/signals", async (c) => {
  const [count, rows] = await Promise.all([countRawSignals(c.env.DB), listRecentRawSignals(c.env.DB, 25)]);
  return c.html(renderSignals(count, rows));
});

// Manual trigger for local dev (`wrangler dev` doesn't fire cron on its own
// without --test-scheduled). Same code path as the scheduled handler below.
app.post("/debug/ingest/gdelt", async (c) => {
  const result = await runGdeltIngest(c.env);
  return c.json(result);
});

async function runGdeltIngest(env: Env) {
  const articles = await fetchGdeltAviationSignals();
  const result = await upsertRawSignals(env.DB, "gdelt", articles);
  return { source: "gdelt", fetched: articles.length, ...result };
}

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runGdeltIngest(env).then((r) => console.log("gdelt ingest:", JSON.stringify(r)))
    );
  },
};
