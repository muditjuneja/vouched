import { z } from "zod";
import { envelope } from "../../envelope/builder";
import { provenance } from "../../envelope/provenance";
import { readDataset, type FactDataset } from "../../resources/store";
import type { Env } from "../../types/env";
import type { ToolModule } from "../types";

const inputSchema = z.object({
  uri: z.string().describe("A mcpseo:// resource uri returned in a prior tool response")
});

function isFactDataset(value: unknown): value is FactDataset {
  return typeof value === "object" && value !== null && (value as { version?: unknown }).version === 2;
}

async function handler(args: z.infer<typeof inputSchema>, env: Env) {
  const dataset = await readDataset(env.DATASETS, args.uri, env.__tenantId ?? null);

  if (isFactDataset(dataset)) {
    // Replays the stored facts with their original type, data and
    // provenance: an exported row reads exactly like an inline one.
    const observedAt = new Date(dataset.observed_at);
    const builder = envelope("core", { uri: args.uri, fact_type: dataset.fact_type, rows: dataset.items.length });
    for (const entity of dataset.entities) builder.addEntity(entity);
    for (const item of dataset.items) {
      builder.addFact({
        type: dataset.fact_type,
        subject: item.subject,
        data: item.data,
        provenance: provenance(dataset.source_class, dataset.method, { observedAt, cacheHit: true })
      });
    }
    return builder
      .setCoverage({
        returned: dataset.items.length,
        // At the cap, more rows may exist, so the total is unknown.
        total: dataset.capped ? null : dataset.items.length,
        as_of: dataset.observed_at,
        scope_note: dataset.capped
          ? `stopped at the ${dataset.row_limit}-row export limit; narrow the date range or add a filter to see the rest`
          : "every row the source returned for this query"
      })
      .build();
  }

  // An export stored before the fact format (raw rows): passed through
  // as-is, without claiming it's complete.
  const count = Array.isArray(dataset) ? dataset.length : 1;
  return envelope("core", { uri: args.uri, dataset })
    .setCoverage({ returned: count, total: null, as_of: null, scope_note: "raw rows from an older export; may be capped" })
    .build();
}

export const exportDataset: ToolModule<typeof inputSchema> = {
  name: "export_dataset",
  title: "Export dataset",
  description: "Download the full result behind an mcpseo:// URI when a tool's response was truncated. Results are kept for 7 days.",
  inputSchema,
  handler
};
