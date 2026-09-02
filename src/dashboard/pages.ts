import type { ConnectionState } from "../auth/google-oauth";
import type { McpApiKeyRow } from "../db/mcp-api-keys";
import type { Plan } from "../db/subscriptions";
import type { WebsiteRow } from "../db/websites";
import { esc, layout } from "./html";

function connectionBadge(state: ConnectionState | "not_configured"): string {
  if (state === "not_configured") return `<span class="badge badge-not_connected">not configured</span>`;
  if (state === "connected") return `<span class="badge badge-connected">connected</span>`;
  if (state === "reconnect_required") return `<span class="badge badge-reconnect">reconnect needed</span>`;
  return `<span class="badge badge-not_connected">not connected</span>`;
}

export interface DashboardWebsite {
  row: WebsiteRow;
  gsc: ConnectionState | "not_configured";
  ga4: ConnectionState | "not_configured";
}

export interface DashboardData {
  websites: DashboardWebsite[];
  plan: Plan;
  usageUsd: number;
  quotaUsd: number;
  apiKeys: McpApiKeyRow[];
  googleOAuthConfigured: boolean;
  dodoConfigured: boolean;
}

function websitesSection(data: DashboardData): string {
  const rows = data.websites
    .map(
      ({ row, gsc, ga4 }) => `<tr>
        <td>${esc(row.name)}<div class="muted">${esc(row.primary_domain)}</div></td>
        <td>${connectionBadge(gsc)}${
          gsc !== "connected"
            ? data.googleOAuthConfigured && row.gsc_site_url
              ? ` <a href="/oauth/google/start?scope=webmaster_console">connect</a>`
              : ""
            : ""
        }</td>
        <td>${connectionBadge(ga4)}${
          ga4 !== "connected"
            ? data.googleOAuthConfigured && row.ga4_property_id
              ? ` <a href="/oauth/google/start?scope=analytics_property">connect</a>`
              : ""
            : ""
        }</td>
      </tr>`
    )
    .join("\n");

  return `<section>
    <h1>Websites</h1>
    ${
      data.websites.length === 0
        ? `<p class="muted">No websites tracked yet — add one below to unlock audit/gsc/analytics tools for it.</p>`
        : `<table><thead><tr><th>Site</th><th>Search Console</th><th>Analytics</th></tr></thead><tbody>${rows}</tbody></table>`
    }
    <form method="post" action="/dashboard/websites" class="row" style="margin-top:0.75rem">
      <input name="name" placeholder="Display name" required>
      <input name="primaryDomain" placeholder="example.com" required>
      <input name="gscSiteUrl" placeholder="sc-domain:example.com (optional)">
      <input name="ga4PropertyId" placeholder="properties/123456789 (optional)">
      <button type="submit">Add website</button>
    </form>
  </section>`;
}

function billingSection(data: DashboardData): string {
  const pct = data.quotaUsd > 0 ? Math.min(100, Math.round((data.usageUsd / data.quotaUsd) * 100)) : 0;
  return `<section>
    <h1>Plan &amp; usage</h1>
    <p>Current plan: <strong>${esc(data.plan)}</strong></p>
    ${
      data.plan === "free"
        ? `<p class="muted">Free doesn't include bundled DataForSEO access — self-host with your own key, or upgrade below.</p>`
        : `<p>DataForSEO usage this period: $${data.usageUsd.toFixed(2)} / $${data.quotaUsd.toFixed(2)} (${pct}%)</p>`
    }
    ${
      data.dodoConfigured
        ? `<div class="row">
            <form method="get" action="/billing/checkout" class="row">
              <input type="hidden" name="plan" value="pro">
              <input type="email" name="email" placeholder="you@example.com" required>
              <button type="submit">Upgrade to Pro ($10/mo included usage)</button>
            </form>
          </div>
          <div class="row" style="margin-top:0.5rem">
            <form method="get" action="/billing/checkout" class="row">
              <input type="hidden" name="plan" value="team">
              <input type="email" name="email" placeholder="you@example.com" required>
              <button type="submit">Upgrade to Team ($50/mo included usage)</button>
            </form>
          </div>`
        : `<p class="muted">Billing isn't configured on this deployment yet.</p>`
    }
  </section>`;
}

function apiKeysSection(data: DashboardData): string {
  const rows = data.apiKeys
    .map(
      (key) => `<tr>
        <td>${esc(key.label ?? "(unlabeled)")}</td>
        <td class="muted">${esc(key.created_at)}</td>
        <td class="muted">${key.last_used_at ? esc(key.last_used_at) : "never used"}</td>
        <td>
          <form method="post" action="/dashboard/api-keys/${esc(key.key_id)}/revoke" class="inline"
                onsubmit="return confirm('Revoke this key? Anything using it will stop working immediately.')">
            <button type="submit">Revoke</button>
          </form>
        </td>
      </tr>`
    )
    .join("\n");

  return `<section>
    <h1>MCP API keys</h1>
    <p class="muted">Use one of these to connect this server to Claude/an MCP client — add it as
      <code>Authorization: Bearer &lt;key&gt;</code>. Each key is shown once, at creation.</p>
    ${
      data.apiKeys.length > 0
        ? `<table><thead><tr><th>Label</th><th>Created</th><th>Last used</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
        : ""
    }
    <form method="post" action="/dashboard/api-keys" class="row" style="margin-top:0.75rem">
      <input name="label" placeholder="e.g. my laptop">
      <button type="submit">Create new key</button>
    </form>
  </section>`;
}

export function renderDashboard(data: DashboardData): string {
  return layout(
    "Dashboard",
    [websitesSection(data), billingSection(data), apiKeysSection(data)].join("\n")
  );
}

/** The one-time reveal page for a newly created API key — never shown again after this. */
export function renderApiKeyCreated(plaintext: string): string {
  return layout(
    "New API key",
    `<section>
      <h1>Your new API key</h1>
      <div class="callout">
        <p><strong>Copy this now</strong> — it won't be shown again.</p>
        <p class="key">${esc(plaintext)}</p>
      </div>
      <p>Add it to your MCP client, e.g.:</p>
      <pre class="key">claude mcp add --transport http mcp-seo-toolkit https://&lt;your-worker&gt;/mcp \\
  --header "Authorization: Bearer ${esc(plaintext)}"</pre>
      <p><a href="/dashboard">&larr; Back to dashboard</a></p>
    </section>`
  );
}

export function renderSignInRequired(currentUrl: string, signInUrl: string | null): string {
  const target = signInUrl
    ? `${signInUrl}${signInUrl.includes("?") ? "&" : "?"}redirect_url=${encodeURIComponent(currentUrl)}`
    : null;
  return layout(
    "Sign in",
    `<section>
      <h1>Sign in required</h1>
      ${
        target
          ? `<p><a href="${esc(target)}">Sign in to continue</a></p>`
          : `<p class="muted">No sign-in page is configured on this deployment (CLERK_SIGN_IN_URL).</p>`
      }
    </section>`
  );
}
