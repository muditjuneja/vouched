import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // Keep test D1/R2 state isolated from `wrangler dev`'s local state.
          d1Databases: ["DB"],
          r2Buckets: ["DATASETS"]
        }
      }
    }
  }
});
