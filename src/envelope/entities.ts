import type { Entity } from "./types";

/**
 * Deterministic, dependency-free short hash (FNV-1a) for minting stable
 * entity ids from URLs/strings. Not cryptographic, just needs to be stable
 * and collision-unlikely for the id space this server deals with.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Exported for reuse by src/dashboard/discovery.ts, which matches GSC/GA4 properties onto the same domain without any tenant-typed input. */
export function normalizeDomain(domainOrUrl: string): string {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(domainOrUrl)
    ? domainOrUrl
    : `https://${domainOrUrl}`;
  const host = new URL(withScheme).hostname.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  // Trailing slash on a bare path is not a meaningfully different page.
  if (u.pathname !== "/" && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

/** A domain's brand word, for spotting a company's own sites and brand searches: "www.resend.com" -> "resend". */
export function brandOf(domainOrUrl: string): string {
  return normalizeDomain(domainOrUrl).split(".")[0] ?? "";
}

/** Canonical id for a domain/site, e.g. "domain:example.com". */
export function domainEntityId(domainOrUrl: string): string {
  return `domain:${normalizeDomain(domainOrUrl)}`;
}

/** Canonical id for a keyword, scoped by language + location. */
export function keywordEntityId(
  text: string,
  lang = "en",
  loc = "US"
): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  return `keyword:${lang}:${loc}:${normalized}`;
}

/** Canonical id for a single page/URL. */
export function pageEntityId(url: string): string {
  return `page:${fnv1a(normalizeUrl(url))}`;
}

/** Canonical id for a tracked/owned website property. */
export function propertyEntityId(websiteId: string): string {
  return `property:${websiteId}`;
}

/** Canonical id for one backlink (a specific source->target link edge). */
export function backlinkEntityId(sourceUrl: string, targetUrl: string): string {
  return `backlink:${fnv1a(`${normalizeUrl(sourceUrl)}->${normalizeUrl(targetUrl)}`)}`;
}

/**
 * Dedupes entities by id, merging `attrs` (later entries win per-key) so
 * repeated mentions of the same domain/keyword across facts collapse into
 * one entity instead of duplicating.
 */
export function dedupeEntities(entities: Entity[]): Entity[] {
  const byId = new Map<string, Entity>();
  for (const entity of entities) {
    const existing = byId.get(entity.id);
    if (!existing) {
      byId.set(entity.id, { ...entity });
      continue;
    }
    byId.set(entity.id, {
      ...existing,
      ...entity,
      attrs: { ...existing.attrs, ...entity.attrs }
    });
  }
  return [...byId.values()];
}
