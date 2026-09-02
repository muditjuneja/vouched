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

if (!has("MCP_BEARER_TOKEN")) {
  console.log("\nCopy .dev.vars.example to .dev.vars and set at least MCP_BEARER_TOKEN.");
  process.exitCode = 1;
}
