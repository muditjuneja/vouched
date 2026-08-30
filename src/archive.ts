// R2 archiving of raw source payloads — durability insurance independent of
// D1. Matters most for sources that delete their own history (e.g. FAA's
// rolling 10-day CSV, once implemented), but cheap enough to do for every
// source from day one rather than retrofitting it later.

export async function archiveRawPayload(bucket: R2Bucket, source: string, payload: unknown): Promise<void> {
  const now = new Date();
  const key = `${source}/${now.toISOString().slice(0, 10)}/${now.toISOString()}.json`;
  await bucket.put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: "application/json" },
  });
}
