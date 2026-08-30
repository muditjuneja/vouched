import { UpstreamError } from "../lib/errors";

const URI_SCHEME = "mcpseo://";

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

export async function readDataset(bucket: R2Bucket, uri: string): Promise<unknown> {
  if (!uri.startsWith(URI_SCHEME)) {
    throw new UpstreamError("resources", `not a mcpseo:// resource uri: ${uri}`);
  }
  const key = uri.slice(URI_SCHEME.length);
  const object = await bucket.get(key);
  if (!object) {
    throw new UpstreamError("resources", `dataset not found or expired: ${uri}`, 404);
  }
  return object.json();
}
