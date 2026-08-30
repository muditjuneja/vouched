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

  return envelope("core", { uri: args.uri, dataset })
    .setCoverage({ returned: 1, total: 1, as_of: null, scope_note: "full, untruncated dataset" })
    .build();
}

export const exportDataset: ToolModule<typeof inputSchema> = {
  name: "export_dataset",
  title: "Export dataset",
  description: "Fetch a full dataset by mcpseo:// uri (for results a summary call truncated).",
  inputSchema,
  handler
};
