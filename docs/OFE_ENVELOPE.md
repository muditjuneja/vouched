# The OFE envelope

Every tool in this server returns the same shape — confirmed against
OpenRush's own live `describe_capabilities`/`list_websites` responses, so
this is a drop-in-compatible response contract, not an invented one.

```ts
{
  schema_version: "ofe/1.0",
  domain: string,        // which domain this envelope belongs to
  data: { ... },         // the compact, tool-specific payload
  facts: Fact[],         // typed, namespaced claims — the real content
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

Trust a fact by its `provenance`, not by which tool produced it — a single
call (`inspect_keyword`) can mix `search_index` and `live_serp` facts in one
response, and each carries its own confidence.

## Canonical entity ids

Minted once in `src/envelope/entities.ts`, so the same domain/keyword/page
always gets the same id across every tool call, letting you link a fact
back to `entities[]` or pass an id straight into another tool:

- `domain:<host>` — scheme/`www.`/case normalized
- `keyword:<lang>:<loc>:<normalized text>`
- `page:<hash of normalized url>`
- `property:<website_id>` — a tracked/owned site (see `core.list_websites`)
- `backlink:<hash of source url>-><hash of target url>`

## What's real vs. deferred in this build

- `facts`/`entities`/`coverage` — fully real for every implemented tool.
- `deltas` — real where a tool populates them (nothing does yet — the
  `observations` D1 table this needs exists from M0, wiring a tool to
  write/diff against it is a fast-follow, not required for parity with
  OpenRush's own — mostly empty — `deltas` responses observed this session).
- `resources`/`export_dataset` — implemented (`src/resources/store.ts`,
  R2-backed), but no tool currently emits a `resources[]` entry — every
  current tool's result set is small enough to inline. Large result sets
  (e.g. `inspect_backlinks` with `view: "backlinks"` at a high limit) are a
  natural candidate to wire up next.
- `next_actions` — the type and builder support exist; no tool populates
  them yet. Chaining today works fine by hand (e.g. call `discover_ai_citations`
  with a topic, or `inspect_domain` before `research_keywords`).
