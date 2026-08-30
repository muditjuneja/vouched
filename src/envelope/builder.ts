import { dedupeEntities } from "./entities";
import {
  OFE_SCHEMA_VERSION,
  type Coverage,
  type Delta,
  type Entity,
  type Envelope,
  type Fact,
  type NextAction,
  type ResourceRef
} from "./types";

const EMPTY_COVERAGE: Coverage = {
  returned: 0,
  total: null,
  as_of: null,
  scope_note: null
};

/**
 * The single place that knows the OFE envelope shape. Every domain handler
 * builds its response through this — never by hand — so all 18 tools stay
 * shape-consistent (facts/provenance, deduped entities, coverage, etc).
 */
export class EnvelopeBuilder<T extends Record<string, unknown>> {
  private readonly domain: string;
  private readonly payload: T;
  private facts: Fact[] = [];
  private entities: Entity[] = [];
  private coverage: Coverage = { ...EMPTY_COVERAGE };
  private deltas: Delta[] = [];
  private resources: ResourceRef[] = [];
  private nextActions: NextAction[] = [];

  constructor(domain: string, data: T) {
    this.domain = domain;
    this.payload = data;
  }

  addFact(fact: Fact): this {
    this.facts.push(fact);
    return this;
  }

  addFacts(facts: Fact[]): this {
    this.facts.push(...facts);
    return this;
  }

  addEntity(entity: Entity): this {
    this.entities.push(entity);
    return this;
  }

  addEntities(entities: Entity[]): this {
    this.entities.push(...entities);
    return this;
  }

  setCoverage(coverage: Partial<Coverage>): this {
    this.coverage = { ...this.coverage, ...coverage };
    return this;
  }

  addDelta(delta: Delta): this {
    this.deltas.push(delta);
    return this;
  }

  addResource(resource: ResourceRef): this {
    this.resources.push(resource);
    return this;
  }

  addNextAction(action: NextAction): this {
    this.nextActions.push(action);
    return this;
  }

  build(): Envelope<T> {
    // If a handler never called setCoverage explicitly, default `returned`
    // to the fact count rather than leaving it silently at 0.
    const coverage =
      this.coverage.returned === 0 && this.facts.length > 0
        ? { ...this.coverage, returned: this.facts.length }
        : this.coverage;

    return {
      schema_version: OFE_SCHEMA_VERSION,
      domain: this.domain,
      data: this.payload,
      facts: this.facts,
      entities: dedupeEntities(this.entities),
      coverage,
      deltas: this.deltas,
      resources: this.resources,
      next_actions: this.nextActions
    };
  }
}

export function envelope<T extends Record<string, unknown>>(
  domain: string,
  data: T
): EnvelopeBuilder<T> {
  return new EnvelopeBuilder(domain, data);
}
