import { describe, expect, it } from "vitest";
import { envelope } from "../../../src/envelope/builder";
import { domainEntityId, keywordEntityId } from "../../../src/envelope/entities";
import { provenance } from "../../../src/envelope/provenance";

describe("envelope builder", () => {
  it("produces a well-formed OFE envelope with sane defaults", () => {
    const result = envelope("seo", { query: "widgets" }).build();

    expect(result.schema_version).toBe("ofe/1.0");
    expect(result.domain).toBe("seo");
    expect(result.data).toEqual({ query: "widgets" });
    expect(result.facts).toEqual([]);
    expect(result.entities).toEqual([]);
    expect(result.coverage).toEqual({
      returned: 0,
      total: null,
      as_of: null,
      scope_note: null
    });
    expect(result.deltas).toEqual([]);
    expect(result.resources).toEqual([]);
    expect(result.next_actions).toEqual([]);
  });

  it("defaults coverage.returned to the fact count when not set explicitly", () => {
    const result = envelope("seo", {})
      .addFact({
        type: "seo.keyword_opportunity",
        subject: [keywordEntityId("widgets")],
        data: { search_volume: 1000 },
        provenance: provenance("search_index", "labs.keyword_ideas")
      })
      .addFact({
        type: "seo.keyword_opportunity",
        subject: [keywordEntityId("gadgets")],
        data: { search_volume: 500 },
        provenance: provenance("search_index", "labs.keyword_ideas")
      })
      .build();

    expect(result.coverage.returned).toBe(2);
  });

  it("lets an explicit setCoverage win over the fact-count default", () => {
    const result = envelope("seo", {})
      .addFact({
        type: "seo.keyword_opportunity",
        subject: [keywordEntityId("widgets")],
        data: {},
        provenance: provenance("search_index", "labs.keyword_ideas")
      })
      .setCoverage({ returned: 1, total: 5000, scope_note: "top 1 of 5000 shown" })
      .build();

    expect(result.coverage).toEqual({
      returned: 1,
      total: 5000,
      as_of: null,
      scope_note: "top 1 of 5000 shown"
    });
  });

  it("dedupes entities by id and merges their attrs", () => {
    const result = envelope("seo", {})
      .addEntity({ id: domainEntityId("example.com"), kind: "domain", label: "example.com", attrs: { a: 1 } })
      .addEntity({ id: domainEntityId("example.com"), kind: "domain", label: "example.com", attrs: { b: 2 } })
      .addEntity({ id: domainEntityId("other.com"), kind: "domain", label: "other.com" })
      .build();

    expect(result.entities).toHaveLength(2);
    const example = result.entities.find((e) => e.id === "domain:example.com");
    expect(example?.attrs).toEqual({ a: 1, b: 2 });
  });

  it("normalizes domain entity ids (scheme, www, case)", () => {
    expect(domainEntityId("https://WWW.Example.com/path")).toBe("domain:example.com");
    expect(domainEntityId("example.com")).toBe("domain:example.com");
  });

  it("keeps deltas, resources, and next_actions as pass-through arrays", () => {
    const result = envelope("seo", {})
      .addDelta({
        subject: domainEntityId("example.com"),
        fact_type: "seo.domain_summary",
        field: "organic_traffic",
        previous: 1000,
        current: 1200,
        observed_at: new Date().toISOString()
      })
      .addResource({ uri: "mcpseo://seo/research_keywords/run-1", description: "full 5000-row result" })
      .addNextAction({
        tool: "seo.inspect_keyword",
        args: { keyword: "widgets" },
        use_when: "you want SERP-level detail on the top result"
      })
      .build();

    expect(result.deltas).toHaveLength(1);
    expect(result.resources).toHaveLength(1);
    expect(result.next_actions).toHaveLength(1);
  });

  it("gives provenance() a sensible default confidence per source_class", () => {
    expect(provenance("webmaster_console", "gsc.searchAnalytics.query").confidence).toBe(1);
    expect(provenance("ai_answer", "llm_mentions").confidence).toBeLessThan(
      provenance("search_index", "labs.ranked_keywords").confidence
    );
  });
});
