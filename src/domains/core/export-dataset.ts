import { z } from "zod";
import { envelope } from "../../envelope/builder";
import { readDataset } from "../../resources/store";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  uri: z.string().describe("A mcpseo:// resource uri returned in a prior tool response")
});

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const dataset = await readDataset(env.DATASETS, args.uri);
  // Every current producer of a mcpseo:// uri (get_search_performance) stores
  // an array of rows, so `returned`/`total` should count rows, not "1
  // dataset object": reporting 1 while actually carrying, say, 1000 rows
  // is a real, misleading undercount. Falls back to 1 only for a
  // non-array dataset, which nothing currently stores.
  const count = Array.isArray(dataset) ? dataset.length : 1;

  return envelope("core", { uri: args.uri, dataset })
    .setCoverage({ returned: count, total: count, as_of: null, scope_note: "full, untruncated dataset" })
    .build();
}

export const exportDataset: ToolModule<typeof inputSchema> = {
  name: "export_dataset",
  title: "Export dataset",
  description: "Download the full result behind an mcpseo:// URI when a tool's response was truncated. Results are kept for 7 days.",
  inputSchema,
  handler
};
