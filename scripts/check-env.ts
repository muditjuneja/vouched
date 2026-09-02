/**
 * `npm run doctor` — a local sanity check of which domains are usable given
 * the current `.dev.vars`. Reads plain env vars via `process.env` (this
 * script runs under plain Node via tsx, not the Workers runtime) so it
 * mirrors `.dev.vars`/secrets naming exactly.
 */
import { readFileSync, existsSync } from "node:fs";

function loadDevVars(): Record<string, string> {
  if (!existsSync(".dev.vars")) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(".dev.vars", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const vars = { ...loadDevVars(), ...process.env };
const has = (key: string) => Boolean(vars[key]);

console.log("mcp-seo-toolkit — environment check\n");

console.log(
  `[${has("MCP_BEARER_TOKEN") ? "x" : " "}] MCP_BEARER_TOKEN set — required for the server to accept any request`
);

const dataforseo = has("DATAFORSEO_LOGIN") && has("DATAFORSEO_PASSWORD");
console.log(
  `[${dataforseo ? "x" : " "}] DataForSEO configured — unlocks seo/serp/backlinks/ai_visibility (12 tools)`
);

const google = has("GOOGLE_OAUTH_CLIENT_ID") && has("GOOGLE_OAUTH_CLIENT_SECRET");
console.log(
  `[${google ? "x" : " "}] Google OAuth client configured — needed before you can connect a Google account for gsc/analytics`
);
if (google) {
  console.log(
    "    Run the OAuth flow per-scope-group: visit /oauth/google/start?scope=webmaster_console&setup_token=<MCP_BEARER_TOKEN>" +
      " (and again with scope=analytics_property) on your deployed/dev Worker."
  );
}

console.log(`[x] core + audit tiers — free, no keys needed (4 tools)`);

const cloudMode = has("CLOUD_MODE");
console.log(`\n--- Cloud offering (${cloudMode ? "ON" : "off — self-host mode"}) ---`);

if (cloudMode) {
  const clerk = has("CLERK_SECRET_KEY");
  console.log(`[${clerk ? "x" : " "}] CLERK_SECRET_KEY set — required for cloud mode to actually engage`);
  console.log(
    `[${has("CLERK_JWT_KEY") ? "x" : " "}] CLERK_JWT_KEY set — zero-network-roundtrip session verification (recommended; falls back to CLERK_SECRET_KEY's API call otherwise)`
  );
  console.log(
    `[${has("CLERK_SIGN_IN_URL") ? "x" : " "}] CLERK_SIGN_IN_URL set — where /dashboard sends a signed-out visitor`
  );

  const dodo = has("DODO_API_KEY") && has("DODO_WEBHOOK_SECRET");
  console.log(`[${dodo ? "x" : " "}] Dodo Payments configured (DODO_API_KEY + DODO_WEBHOOK_SECRET)`);
  console.log(
    `[${has("DODO_PRODUCT_ID_PRO") ? "x" : " "}] DODO_PRODUCT_ID_PRO set   [${has("DODO_PRODUCT_ID_TEAM") ? "x" : " "}] DODO_PRODUCT_ID_TEAM set`
  );
  if (has("DODO_ENVIRONMENT") && vars.DODO_ENVIRONMENT !== "live_mode") {
    console.log(`    DODO_ENVIRONMENT="${vars.DODO_ENVIRONMENT}" — not live_mode, so real payments won't process`);
  }

  const bundledDfs = has("CLOUD_DATAFORSEO_LOGIN") && has("CLOUD_DATAFORSEO_PASSWORD");
  console.log(
    `[${bundledDfs ? "x" : " "}] Bundled DataForSEO account configured (CLOUD_DATAFORSEO_LOGIN/PASSWORD) — without this, Pro/Team tenants can't use the paid tools at all`
  );

  const email = has("XMIT_API_KEY") && has("XMIT_FROM_EMAIL");
  console.log(
    `[${email ? "x" : " "}] XMIT_API_KEY + XMIT_FROM_EMAIL set — transactional email (welcome/billing/quota/reconnect notices)`
  );
  console.log(
    `[${has("ADMIN_ALERT_WEBHOOK_URL") ? "x" : " "}] ADMIN_ALERT_WEBHOOK_URL set — operator alerts on billing failures/budget warnings (optional)`
  );

  if (!clerk) {
    console.log("\nCLOUD_MODE is set but CLERK_SECRET_KEY isn't — cloud routes will 404, self-host behavior applies.");
  }
} else {
  console.log("Set CLOUD_MODE=1 (plus CLERK_SECRET_KEY at minimum) to enable the dashboard, billing, and bundled DataForSEO access.");
}

if (!has("MCP_BEARER_TOKEN")) {
  console.log("\nCopy .dev.vars.example to .dev.vars and set at least MCP_BEARER_TOKEN.");
  process.exitCode = 1;
}
