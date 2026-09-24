import type { Entity, Provenance } from "../envelope/types";
import { UpstreamError } from "../lib/errors";

/**
 * What an export holds: the same facts the inline response carried (same
 * type, data shape and provenance), just more of them, so a row reads the
 * same whether it came inline or through export_dataset.
 */
export interface FactDataset {
  version: 2;
  fact_type: string;
  source_class: Provenance["source_class"];
  method: string;
  /** When the data was fetched from the source. */
  observed_at: string;
  /** True when the export stopped at `row_limit`, so more rows may exist. */
  capped: boolean;
  row_limit: number;
  entities: Entity[];
  items: Array<{ subject: string[]; data: Record<string, unknown> }>;
}

const URI_SCHEME = "mcpseo://";

/**
 * Exports are deleted after this many days. The bucket's lifecycle rule
 * does the deleting (see docs/DEPLOY.md), but it runs lazily, so reads
 * also refuse anything older: the privacy policy promises 7 days.
 */
export const DATASET_TTL_DAYS = 7;

/**
 * Stores a full (non-truncated) dataset in R2 and mints the `mcpseo://`
 * resource URI a summary response can point to instead of inlining
 * everything. `export_dataset` resolves the same URI back via `readDataset`.
 */
export async function storeDataset(
  bucket: R2Bucket,
  domain: string,
  tool: string,
  data: unknown
): Promise<string> {
  const runId = crypto.randomUUID();
  const key = `${domain}/${tool}/${runId}.json`;
  await bucket.put(key, JSON.stringify(data), {
    httpMetadata: { contentType: "application/json" }
  });
  return `${URI_SCHEME}${key}`;
}

export async function readDataset(bucket: R2Bucket, uri: string, now: Date = new Date()): Promise<unknown> {
  if (!uri.startsWith(URI_SCHEME)) {
    throw new UpstreamError("resources", `not a mcpseo:// resource uri: ${uri}`);
  }
  const key = uri.slice(URI_SCHEME.length);
  const object = await bucket.get(key);
  if (!object || now.getTime() - object.uploaded.getTime() > DATASET_TTL_DAYS * 86_400_000) {
    throw new UpstreamError("resources", `dataset not found or expired: ${uri}`, 404);
  }
  return object.json();
}
