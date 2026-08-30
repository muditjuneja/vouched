import { html } from "hono/html";
import type { Incident } from "./db";

// Design direction from the research pass: dark-default, restrained, no
// alarm-red/pulsing states, monospace for hard data vs. a plain sans for
// editorial text. This is deliberately plain CSS (no build step) for v1 —
// swap in a real design pass once the product shape is validated.

const STATUS_LABEL: Record<Incident["status"], string> = {
  unconfirmed: "Unconfirmed report",
  confirmed_no_fatalities: "Confirmed — no fatalities",
  confirmed_fatalities: "Confirmed — fatalities",
  investigating: "Investigation ongoing",
};

// One muted color per status, applied identically everywhere. No
// escalating/pulsing treatment as severity increases — see design research.
const STATUS_COLOR: Record<Incident["status"], string> = {
  unconfirmed: "#8a8f98",
  confirmed_no_fatalities: "#4a90a4",
  confirmed_fatalities: "#a45a52",
  investigating: "#8a7a4a",
};

function layout(title: string, body: unknown) {
  return html`<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; }
    body {
      background: #0e0f11;
      color: #e6e6e6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      line-height: 1.5;
    }
    .wrap { max-width: 760px; margin: 0 auto; padding: 2rem 1.25rem; }
    header h1 { font-size: 1.1rem; font-weight: 600; letter-spacing: 0.01em; margin: 0 0 0.25rem; }
    header p { color: #8a8f98; margin: 0 0 2rem; font-size: 0.9rem; }
    .incident { border-top: 1px solid #22252a; padding: 1.25rem 0; }
    .incident:first-of-type { border-top: none; }
    .status {
      display: inline-block;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 0.72rem;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      padding: 0.15rem 0.5rem;
      border-radius: 3px;
      margin-bottom: 0.5rem;
    }
    .incident h2 { font-size: 1rem; font-weight: 600; margin: 0 0 0.35rem; }
    .incident .meta { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.78rem; color: #8a8f98; }
    .incident p.summary { margin: 0.5rem 0 0; color: #c4c7cc; font-size: 0.92rem; }
    footer { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #22252a; color: #6b6f76; font-size: 0.78rem; }
    a { color: #7fb0c4; }
  </style>
</head>
<body>
  <div class="wrap">${body}</div>
</body>
</html>`;
}

export function renderHome(incidents: Incident[]) {
  return layout(
    "planecrashes.today",
    html`
      <header>
        <h1>planecrashes.today</h1>
        <p>Prototype — sample data mixed with live-ingested signal. Not a production feed yet.</p>
      </header>
      ${incidents.length === 0
        ? html`<p>No incidents recorded yet.</p>`
        : incidents.map(
            (inc) => html`
              <article class="incident">
                <span class="status" style="background:${STATUS_COLOR[inc.status]}22; color:${STATUS_COLOR[inc.status]}">
                  ${STATUS_LABEL[inc.status]}
                </span>
                <h2><a href="/incident/${inc.id}">${inc.title}</a></h2>
                <div class="meta">
                  ${inc.location ?? "Location unknown"}${inc.country ? `, ${inc.country}` : ""}
                  ${inc.occurred_at ? html` · ${inc.occurred_at}` : html` · first seen ${inc.first_seen_at}`}
                </div>
                ${inc.summary ? html`<p class="summary">${inc.summary}</p>` : ""}
              </article>
            `
          )}
      <footer>Sources credited on each incident page. Facts + metadata only — see /about/sourcing (TODO).</footer>
    `
  );
}

export function renderIncident(inc: Incident) {
  const sources: { name: string; url: string; type: string }[] = JSON.parse(inc.sources);
  return layout(
    inc.title,
    html`
      <header>
        <p><a href="/">&larr; planecrashes.today</a></p>
      </header>
      <span class="status" style="background:${STATUS_COLOR[inc.status]}22; color:${STATUS_COLOR[inc.status]}">
        ${STATUS_LABEL[inc.status]}
      </span>
      <h1 style="margin-top:0.5rem;">${inc.title}</h1>
      <div class="meta">
        ${inc.location ?? "Location unknown"}${inc.country ? `, ${inc.country}` : ""}
        ${inc.occurred_at ? html` · occurred ${inc.occurred_at}` : ""}
        ${inc.aircraft_type ? html` · ${inc.aircraft_type}` : ""}
        ${inc.operator ? html` · ${inc.operator}` : ""}
      </div>
      ${inc.summary ? html`<p class="summary">${inc.summary}</p>` : ""}
      <h3 style="margin-top:2rem; font-size:0.85rem; color:#8a8f98;">Sources</h3>
      <ul>
        ${sources.map((s) => html`<li><a href="${s.url}" rel="noopener">${s.name}</a></li>`)}
      </ul>
    `
  );
}

export function renderSignals(count: number, rows: unknown[]) {
  return layout(
    "raw signals (debug)",
    html`
      <header>
        <h1>raw_signals (debug view)</h1>
        <p>${count} total rows. Not public — verifies ingestion is landing before triage exists.</p>
      </header>
      <pre style="white-space:pre-wrap; font-size:0.78rem; color:#c4c7cc;">${JSON.stringify(rows, null, 2)}</pre>
    `
  );
}
