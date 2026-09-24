/**
 * The readable content of a SERP feature (People Also Ask questions,
 * related searches, an AI Overview's sources, a local listing), without the
 * page-layout internals (xpath, rectangle) that come with it. Shapes
 * confirmed against test/fixtures/dataforseo/serp.json.
 */
const MAX_ENTRIES = 8;

type Row = Record<string, unknown>;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function entry(row: Row): Record<string, string> | null {
  const out: Record<string, string> = {};
  const title = str(row.title) ?? str(row.alt) ?? str(row.text);
  if (title) out.title = title.length > 300 ? `${title.slice(0, 297)}...` : title;
  for (const key of ["domain", "url"] as const) {
    const value = str(row[key]);
    if (value) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function featureContent(item: Row): Record<string, unknown> {
  const items = Array.isArray(item.items) ? (item.items as unknown[]) : [];
  if (item.type === "people_also_ask") {
    return { questions: items.map((q) => str((q as Row)?.title)).filter(Boolean).slice(0, MAX_ENTRIES) };
  }
  if (item.type === "related_searches") {
    return { queries: items.map(str).filter(Boolean).slice(0, MAX_ENTRIES) };
  }
  if (items.length > 0) {
    return { entries: items.map((row) => entry((row ?? {}) as Row)).filter(Boolean).slice(0, MAX_ENTRIES) };
  }
  const own = entry(item);
  const description = str(item.description);
  return { ...(own ?? {}), ...(description ? { description: description.slice(0, 300) } : {}) };
}
