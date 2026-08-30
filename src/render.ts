import { html } from "hono/html";
import type { Incident } from "./db";

// Design system for planecrashes.today.
//
// From the design research this project ran: dark-default (not dark-only),
// a small fixed set of status colors applied identically everywhere (no
// escalating/alarm treatment as severity increases — GDACS/USGS style, not
// tabloid), and a typographic split that does real trust-signaling work —
// an editorial serif for narrative/headlines, monospace exclusively for
// hard data (times, locations, casualty figures), so a reader can tell
// "reported fact" from "editorial voice" at a glance without either being
// dramatized.

const STATUS_LABEL: Record<Incident["status"], string> = {
  unconfirmed: "Unconfirmed report",
  confirmed_no_fatalities: "Confirmed — no fatalities",
  confirmed_fatalities: "Confirmed — fatalities",
  investigating: "Investigation ongoing",
};

const STATUS_COLOR: Record<Incident["status"], string> = {
  unconfirmed: "#9a9fa8",
  confirmed_no_fatalities: "#5b9bb0",
  confirmed_fatalities: "#c17b6f",
  investigating: "#b39a5b",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // non-ISO source string — show as-is rather than "Invalid Date"
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function statusPill(status: Incident["status"]) {
  return html`<span class="pill" style="--pill-color:${STATUS_COLOR[status]}">
    <span class="pill-dot"></span>${STATUS_LABEL[status]}
  </span>`;
}

function layout(title: string, description: string, body: unknown) {
  return html`<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${description}" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
    rel="stylesheet"
  />
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0c0e;
      --bg-raised: #131417;
      --border: #23252a;
      --text: #e7e7e5;
      --text-dim: #9a9ca3;
      --text-faint: #6d6f76;
      --link: #8fb8c9;
      --serif: "Newsreader", Georgia, "Times New Roman", serif;
      --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      --max: 720px;
    }
    * { box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--sans);
      margin: 0;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .wrap { max-width: var(--max); margin: 0 auto; padding: 0 1.5rem; }

    nav {
      border-bottom: 1px solid var(--border);
      padding: 1.1rem 0;
    }
    nav .wrap { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 0.3rem 1rem; }
    @media (max-width: 480px) {
      nav .wrap { flex-direction: column; align-items: flex-start; gap: 0.2rem; }
    }
    .wordmark {
      font-family: var(--serif);
      font-weight: 600;
      font-size: 1.15rem;
      color: var(--text);
      text-decoration: none;
      letter-spacing: -0.01em;
    }
    .wordmark span { color: var(--text-dim); font-weight: 400; }
    .tagline { font-size: 0.78rem; color: var(--text-faint); font-family: var(--mono); }

    main { padding: 2.25rem 0 4rem; }
    .lede { color: var(--text-dim); font-size: 0.94rem; max-width: 46ch; margin: 0 0 2.25rem; }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-family: var(--mono);
      font-size: 0.7rem;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--pill-color);
      background: color-mix(in srgb, var(--pill-color) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--pill-color) 30%, transparent);
      padding: 0.22rem 0.6rem 0.22rem 0.5rem;
      border-radius: 100px;
    }
    .pill-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: none; }

    .incident-list { display: flex; flex-direction: column; }
    .incident-card {
      display: block;
      padding: 1.4rem 0;
      border-top: 1px solid var(--border);
      text-decoration: none;
      color: inherit;
    }
    .incident-list a.incident-card:hover .incident-title { color: var(--link); }
    .incident-card:first-child { border-top: none; padding-top: 0; }

    .incident-title {
      font-family: var(--serif);
      font-size: 1.2rem;
      font-weight: 500;
      line-height: 1.35;
      margin: 0.65rem 0 0.4rem;
      color: var(--text);
    }
    .incident-meta {
      font-family: var(--mono);
      font-size: 0.76rem;
      color: var(--text-faint);
      display: flex;
      flex-wrap: wrap;
      gap: 0 0.6rem;
    }
    .incident-meta .sep { color: var(--border); }
    .incident-summary {
      font-family: var(--serif);
      font-size: 0.95rem;
      color: var(--text-dim);
      margin: 0.55rem 0 0;
      line-height: 1.55;
    }

    .empty {
      color: var(--text-faint);
      font-family: var(--mono);
      font-size: 0.85rem;
      padding: 2rem 0;
      border-top: 1px solid var(--border);
    }

    /* incident detail */
    .back-link {
      display: inline-block;
      font-family: var(--mono);
      font-size: 0.78rem;
      color: var(--text-faint);
      text-decoration: none;
      margin-bottom: 1.5rem;
    }
    .back-link:hover { color: var(--link); }
    h1.detail-title {
      font-family: var(--serif);
      font-size: 1.65rem;
      font-weight: 500;
      line-height: 1.3;
      margin: 0.9rem 0 1rem;
    }
    .fact-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 0.9rem 1.5rem;
      font-family: var(--mono);
      font-size: 0.8rem;
      padding: 1.1rem 0;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      margin: 1.3rem 0 1.6rem;
    }
    .fact-grid dt { color: var(--text-faint); text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.04em; margin-bottom: 0.2rem; }
    .fact-grid dd { margin: 0; color: var(--text); }
    .detail-summary {
      font-family: var(--serif);
      font-size: 1.02rem;
      line-height: 1.65;
      color: var(--text);
    }
    .sources-block { margin-top: 2.5rem; }
    .sources-block h2 {
      font-family: var(--mono);
      text-transform: uppercase;
      font-size: 0.72rem;
      letter-spacing: 0.04em;
      color: var(--text-faint);
      font-weight: 500;
      margin: 0 0 0.7rem;
    }
    .sources-block ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .sources-block a { color: var(--link); font-size: 0.88rem; text-decoration: none; }
    .sources-block a:hover { text-decoration: underline; }

    footer {
      border-top: 1px solid var(--border);
      padding: 1.5rem 0 2.5rem;
      color: var(--text-faint);
      font-size: 0.78rem;
      line-height: 1.6;
    }
    footer a { color: var(--text-faint); }

    a { color: var(--link); }

    pre.debug { white-space: pre-wrap; font-family: var(--mono); font-size: 0.76rem; color: var(--text-dim); }
  </style>
</head>
<body>
  <nav>
    <div class="wrap">
      <a class="wordmark" href="/">planecrashes<span>.today</span></a>
      <span class="tagline">facts + sources, no speculation</span>
    </div>
  </nav>
  <div class="wrap"><main>${body}</main></div>
</body>
</html>`;
}

export function renderHome(incidents: Incident[]) {
  return layout(
    "planecrashes.today — aviation incident tracker",
    "Live-tracked aviation incidents worldwide: facts, sources, and confirmation status — no speculation.",
    html`
      <p class="lede">
        Every incident here is sourced and status-tagged — unconfirmed report, confirmed, or
        under investigation. Nothing is upgraded to a worse status without a source saying so.
      </p>
      ${incidents.length === 0
        ? html`<p class="empty">No incidents recorded yet.</p>`
        : html`<div class="incident-list">
            ${incidents.map((inc) => {
              const when = inc.occurred_at ?? inc.first_seen_at;
              const whenLabel = inc.occurred_at ? "occurred" : "first seen";
              return html`
                <a class="incident-card" href="/incident/${inc.id}">
                  ${statusPill(inc.status)}
                  <h2 class="incident-title">${inc.title}</h2>
                  <div class="incident-meta">
                    <span>${inc.location ?? "Location unknown"}${inc.country ? `, ${inc.country}` : ""}</span>
                    <span class="sep">·</span>
                    <span>${whenLabel} ${formatDate(when)}</span>
                  </div>
                  ${inc.summary ? html`<p class="incident-summary">${inc.summary}</p>` : ""}
                </a>
              `;
            })}
          </div>`}
      <footer>
        Facts and metadata only, credited back to source — see the sourcing note (TODO) for
        what we do and don't republish.
      </footer>
    `
  );
}

export function renderIncident(inc: Incident) {
  const sources: { name: string; url: string; type: string }[] = JSON.parse(inc.sources);
  return layout(
    inc.title,
    inc.summary ?? inc.title,
    html`
      <a class="back-link" href="/">&larr; all incidents</a>
      ${statusPill(inc.status)}
      <h1 class="detail-title">${inc.title}</h1>

      <dl class="fact-grid">
        <div><dt>Location</dt><dd>${inc.location ?? "—"}${inc.country ? `, ${inc.country}` : ""}</dd></div>
        <div><dt>Occurred</dt><dd>${formatDate(inc.occurred_at) ?? "Unknown"}</dd></div>
        <div><dt>Aircraft</dt><dd>${inc.aircraft_type ?? "—"}</dd></div>
        <div><dt>Operator</dt><dd>${inc.operator ?? "—"}</dd></div>
        ${inc.flight_number ? html`<div><dt>Flight</dt><dd>${inc.flight_number}</dd></div>` : ""}
        <div><dt>Fatalities</dt><dd>${inc.fatalities ?? "Unknown"}</dd></div>
        <div><dt>Injuries</dt><dd>${inc.injuries ?? "Unknown"}</dd></div>
        <div><dt>Updated</dt><dd>${formatDate(inc.updated_at)}</dd></div>
      </dl>

      ${inc.summary ? html`<p class="detail-summary">${inc.summary}</p>` : ""}

      <div class="sources-block">
        <h2>Sources</h2>
        <ul>
          ${sources.map((s) => html`<li><a href="${s.url}" rel="noopener" target="_blank">${s.name} &rarr;</a></li>`)}
        </ul>
      </div>
    `
  );
}

export function renderSignals(count: number, rows: unknown[]) {
  return layout(
    "raw signals (debug)",
    "Internal debug view.",
    html`
      <p class="lede">${count} total rows in raw_signals. Not public — verifies ingestion is landing before/after triage.</p>
      <pre class="debug">${JSON.stringify(rows, null, 2)}</pre>
    `
  );
}
