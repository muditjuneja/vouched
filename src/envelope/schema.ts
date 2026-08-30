import { z } from "zod";
import { OFE_SCHEMA_VERSION } from "./types";

const provenanceSchema = z.object({
  source_class: z.enum([
    "live_serp",
    "search_index",
    "backlink_index",
    "crawl",
    "webmaster_console",
    "analytics_property",
    "ai_answer"
  ]),
  method: z.string(),
  confidence: z.number().min(0).max(1),
  observed_at: z.string(),
  cache_hit: z.boolean()
});

const factSchema = z.object({
  type: z.string(),
  subject: z.array(z.string()),
  data: z.record(z.string(), z.unknown()),
  provenance: provenanceSchema
});

const entitySchema = z.object({
  id: z.string(),
  kind: z.enum(["domain", "keyword", "page", "property", "backlink"]),
  label: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional()
});

const coverageSchema = z.object({
  returned: z.number(),
  total: z.number().nullable(),
  as_of: z.string().nullable(),
  scope_note: z.string().nullable()
});

const deltaSchema = z.object({
  subject: z.string(),
  fact_type: z.string(),
  field: z.string(),
  previous: z.unknown(),
  current: z.unknown(),
  observed_at: z.string()
});

const resourceSchema = z.object({
  uri: z.string(),
  description: z.string()
});

const nextActionSchema = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
  use_when: z.string()
});

/**
 * The output schema shared by every tool. `data` stays a loose record since
 * each tool's payload shape differs — the fixed structure (facts,
 * provenance, entities, coverage, deltas, resources, next_actions) is what
 * this validates.
 */
export const ofeEnvelopeSchema = z.object({
  schema_version: z.literal(OFE_SCHEMA_VERSION),
  domain: z.string(),
  data: z.record(z.string(), z.unknown()),
  facts: z.array(factSchema),
  entities: z.array(entitySchema),
  coverage: coverageSchema,
  deltas: z.array(deltaSchema),
  resources: z.array(resourceSchema),
  next_actions: z.array(nextActionSchema)
});
