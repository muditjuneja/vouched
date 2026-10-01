import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // Keep test D1/R2 state isolated from `wrangler dev`'s local state.
        d1Databases: ["DB"],
        r2Buckets: ["DATASETS"]
      }
    })
  ]
});
