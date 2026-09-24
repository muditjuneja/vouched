// The "OFE" (open fact envelope) shape every tool in this server returns.
// Every domain handler builds one of these via `envelope/builder.ts`;
// nothing constructs it by hand.

export const OFE_SCHEMA_VERSION = "ofe/1.0";

/** How sure we are of a fact, and where it came from. */
export interface Provenance {
  source_class:
    | "live_serp"
    | "search_index"
    | "backlink_index"
    | "crawl"
    | "webmaster_console"
    | "analytics_property"
    | "ai_answer";
  method: string;
  /** 0 (pure guess) to 1 (certain). */
  confidence: number;
  /** ISO 8601 timestamp of when this fact was actually observed. */
  observed_at: string;
  cache_hit: boolean;
}

/** A typed, namespaced claim, e.g. "seo.keyword_ranking". */
export interface Fact<T = Record<string, unknown>> {
  type: string;
  /** Canonical entity id(s) this fact is about; links back to `entities`. */
  subject: string[];
  data: T;
  provenance: Provenance;
}

/** A domain/keyword/page/property referenced by one or more facts. */
export interface Entity {
  id: string;
  kind: "domain" | "keyword" | "page" | "property" | "backlink";
  label: string;
  attrs?: Record<string, unknown>;
}

export interface Coverage {
  returned: number;
  total: number | null;
  as_of: string | null;
  scope_note: string | null;
}

/** A change against the last observation of the same tool+subject. */
export interface Delta {
  subject: string;
  fact_type: string;
  field: string;
  previous: unknown;
  current: unknown;
  observed_at: string;
}

/** A pointer to a full dataset too large to inline; fetch via export_dataset. */
export interface ResourceRef {
  uri: string;
  description: string;
}

/** A suggested follow-up tool call. */
export interface NextAction {
  tool: string;
  args: Record<string, unknown>;
  use_when: string;
}

export interface Envelope<T = Record<string, unknown>> {
  schema_version: typeof OFE_SCHEMA_VERSION;
  domain: string;
  data: T;
  facts: Fact[];
  entities: Entity[];
  coverage: Coverage;
  deltas: Delta[];
  resources: ResourceRef[];
  next_actions: NextAction[];
}
