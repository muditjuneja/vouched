import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "cloudflare:workers": "/private/tmp/claude-501/-Users-beingmudit-Work-open-seo-experiments/220d1cfc-48ff-416a-ba32-56e3e604b1e5/scratchpad/cloudflare-workers-stub.mjs" } },
  test: { include: ["test/unit/**/*.test.{ts,tsx}"], server: { deps: { inline: ["@cloudflare/workers-oauth-provider"] } } }
});
