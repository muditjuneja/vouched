# The OFE envelope

Every tool in this server returns the same shape, confirmed against
OpenRush's own live `describe_capabilities`/`list_websites` responses, so
this is a drop-in-compatible response contract, not an invented one.

```ts
{
  schema_version: "ofe/1.0",
  domain: string,        // which domain this envelope belongs to
  data: { ... },         // the compact, tool-specific payload
  facts: Fact[],         // typed, namespaced claims, the real content
  entities: Entity[],    // domains/keywords/pages/properties referenced, deduped
  coverage: Coverage,    // what this result does/doesn't cover
  deltas: Delta[],       // changes vs a prior observation, when one exists
  resources: Resource[], // uris for datasets too large to inline
  next_actions: NextAction[] // suggested follow-up tool calls
}
```

## Facts carry their own provenance

```ts
{
  type: "seo.keyword_opportunity",   // "<domain>.<noun>"
  subject: ["keyword:en:US:widgets"],// canonical entity id(s) this is about
  data: { search_volume: 1200, ... },
  provenance: {
    source_class: "search_index",   // live_serp | search_index | backlink_index
                                     // | crawl | webmaster_console
                                     // | analytics_property | ai_answer
    method: "dataforseo_labs.keyword_ideas",
    confidence: 0.75,               // 0–1, defaulted per source_class
    observed_at: "2026-09-02T...",
    cache_hit: false
  }
}
```

Trust a fact by its `provenance`, not by which tool produced it, a single
call (`inspect_keyword`) can mix `search_index` and `live_serp` facts in one
response, and each carries its own confidence.

## Canonical entity ids

Minted once in `src/envelope/entities.ts`, so the same domain/keyword/page
always gets the same id across every tool call, letting you link a fact
back to `entities[]` or pass an id straight into another tool:

- `domain:<host>`, scheme/`www.`/case normalized
- `keyword:<lang>:<loc>:<normalized text>`
- `page:<hash of normalized url>`
- `property:<website_id>`, a tracked/owned site (see `core.list_websites`)
- `backlink:<hash of source url>-><hash of target url>`

## What's real vs. deferred in this build

- `facts`/`entities`/`coverage`, fully real for every implemented tool.
- `deltas`, real for `get_search_performance` (`compareToPreviousPeriod`:
  two live queries, this period vs. the immediately preceding one of equal
  length, diffed against each other), but that's a narrower mechanism
  than the general one this envelope anticipates. The `observations` D1
  table (keyed by tool + subject + normalized params, meant for "changed
  since the last time this exact question was asked") still exists from
  M0 with nothing reading or writing it; wiring a tool to it is still a
  real fast-follow, distinct from what `get_search_performance` already
  does.
- `resources`/`export_dataset`, implemented (`src/resources/store.ts`,
  R2-backed) and now genuinely exercised: `get_search_performance` fetches
  one extra, larger page only when its own `rowLimit` visibly truncated
  the result, and spills the fuller set here. Every other tool's result set
  is still small enough to inline and emits no `resources[]` entry; large
  result sets elsewhere (e.g. `inspect_backlinks` with `view: "backlinks"`
  at a high limit) are a natural next candidate to wire up the same way.
- `provenance.cache_hit`, real for `get_search_performance` (backed by
  the `CACHE` KV binding, see `src/lib/cache.ts`); every other tool still
  hardcodes `false` since nothing else caches yet.
- `next_actions`, the type and builder support exist; no tool populates
  them yet. Chaining today works fine by hand (e.g. call `discover_ai_citations`
  with a topic, or `inspect_domain` before `research_keywords`).
