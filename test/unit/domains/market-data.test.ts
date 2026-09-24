import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareBacklinkGap } from "../../../src/domains/backlinks/compare-backlink-gap";
import { inspectBacklinks } from "../../../src/domains/backlinks/inspect-backlinks";
import { discoverAiCitations } from "../../../src/domains/ai_visibility/discover-ai-citations";
import { inspectAiVisibility } from "../../../src/domains/ai_visibility/inspect-ai-visibility";
import { compareKeywordCoverage } from "../../../src/domains/seo/compare-keyword-coverage";
import { discoverCompetitors } from "../../../src/domains/seo/discover-competitors";
import { inspectDomain } from "../../../src/domains/seo/inspect-domain";
import { inspectKeyword } from "../../../src/domains/seo/inspect-keyword";
import { inspectPage } from "../../../src/domains/seo/inspect-page";
import { inspectSearchVisibility } from "../../../src/domains/seo/inspect-search-visibility";
import { researchKeywords } from "../../../src/domains/seo/research-keywords";
import { inspectSerp } from "../../../src/domains/serp/inspect-serp";
import { toolError } from "../../../src/mcp/server";
import type { Env } from "../../../src/types/env";

/**
 * Every market-data tool, fed the real response shapes saved from
 * DataForSEO's sandbox (test/fixtures/dataforseo/). These exist because
 * all twelve tools shipped reading `result[0]` as their only row instead of
 * `result[0].items`, so every typed field came back null in production.
 */
const FIXTURE_BY_PATH: Record<string, string> = {
  "/v3/dataforseo_labs/google/domain_rank_overview/live": "domain_rank_overview",
  "/v3/dataforseo_labs/google/ranked_keywords/live": "ranked_keywords",
  "/v3/dataforseo_labs/google/competitors_domain/live": "competitors_domain",
  "/v3/dataforseo_labs/google/keyword_ideas/live": "keyword_ideas",
  "/v3/dataforseo_labs/google/keyword_overview/live": "keyword_overview",
  "/v3/dataforseo_labs/google/domain_intersection/live": "domain_intersection_gap",
  "/v3/serp/google/organic/live/advanced": "serp",
  "/v3/backlinks/summary/live": "backlinks_summary",
  "/v3/backlinks/domain_intersection/live": "backlinks_gap",
  "/v3/backlinks/referring_domains/live": "backlinks_referring_domains",
  "/v3/backlinks/anchors/live": "backlinks_anchors",
  "/v3/backlinks/backlinks/live": "backlinks_list",
  "/v3/ai_optimization/llm_mentions/top_mentioned_domains/live": "llm_top_domains",
  "/v3/ai_optimization/llm_mentions/target_metrics/live": "llm_target_metrics"
};

const requests: Array<{ path: string; body: Record<string, unknown> }> = [];

function fixture(name: string): string {
  return readFileSync(new URL(`../../fixtures/dataforseo/${name}.json`, import.meta.url), "utf8");
}

beforeEach(() => {
  requests.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname;
      const name = FIXTURE_BY_PATH[path];
      if (!name) throw new Error(`no fixture for ${path}`);
      requests.push({ path, body: (JSON.parse(init.body as string) as Array<Record<string, unknown>>)[0]! });
      return new Response(fixture(name), { status: 200 });
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

/** Self-host with its own key: no quota or wallet logic, and a D1 that accepts the cost log write. */
const env = {
  DATASETS: { put: async () => undefined },
  DB: { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) }) },
  DATAFORSEO_LOGIN: "login",
  DATAFORSEO_PASSWORD: "password"
} as unknown as Env;

describe("Labs tools read the rows, not the wrapper", () => {
  it("inspect_domain: traffic and keyword count, top keywords, and competitors without the domain itself", async () => {
    const result = await inspectDomain.handler({ domain: "newmouth.com" }, env);
    const summary = result.facts.find((f) => f.type === "seo.domain_summary");
    expect(summary?.data).toEqual({ estimated_organic_traffic: 32190.367695869878, ranked_keyword_count: 11925 });
    expect(result.facts.filter((f) => f.type === "seo.keyword_ranking").map((f) => f.data.keyword)).toEqual([
      "1000 keywords",
      "alternatives to google trends",
      "amazon search volume api"
    ]);
    const rivals = result.facts.filter((f) => f.type === "seo.competitor").map((f) => f.data.competitor_domain);
    expect(rivals).toEqual(["dentaly.org", "youtube.com"]);
  });

  it("discover_competitors: leaves the domain out of its own competitor list, fetching one extra to make up for it", async () => {
    const result = await discoverCompetitors.handler({ domain: "newmouth.com", limit: 2 }, env);
    expect(requests[0]!.body.limit).toBe(3);
    expect(result.facts.map((f) => f.data.competitor_domain)).toEqual(["dentaly.org", "youtube.com"]);
    expect(result.coverage.returned).toBe(2);
  });

  it("research_keywords: one fact per idea with volume and difficulty", async () => {
    const result = await researchKeywords.handler({ seedKeywords: ["phone"] }, env);
    expect(result.facts.map((f) => [f.data.keyword, f.data.search_volume, f.data.keyword_difficulty])).toEqual([
      ["nothing phone", 165000, 31],
      ["find phone", 14800, 57],
      ["tin can phone", 135000, 5]
    ]);
    expect(result.coverage.returned).toBe(3);
    expect(requests[0]!.body.order_by).toEqual(["keyword_info.search_volume,desc"]);
  });

  it("research_keywords: keeps only ideas that share a word with a seed, and says how many were left out", async () => {
    const result = await researchKeywords.handler({ seedKeywords: ["nothing"] }, env);
    expect(result.facts.map((f) => f.data.keyword)).toEqual(["nothing phone"]);
    expect(result.coverage.scope_note).toContain("2 broader ideas left out");
  });

  it("compare_keyword_coverage: top-20 positions only, highest volume first, brand searches left out, rest exported", async () => {
    const result = await compareKeywordCoverage.handler({ domain: "xmit.sh", competitors: ["source.com"], limit: 1 }, env);
    expect(requests[0]!.body).toMatchObject({
      filters: ["first_domain_serp_element.rank_group", "<=", 20],
      order_by: ["keyword_data.keyword_info.search_volume,desc"]
    });
    // Both fixture keywords contain "source", the competitor's brand.
    expect(result.facts).toHaveLength(0);
    expect(result.coverage.scope_note).toContain("2 searches for a competitor's own brand left out");
  });

  it("compare_keyword_coverage: lists up to the limit and exports the rest", async () => {
    const result = await compareKeywordCoverage.handler({ domain: "semrush.com", competitors: ["ahrefs.com"], limit: 1 }, env);
    expect(result.facts).toHaveLength(1);
    expect(result.resources[0]?.uri).toMatch(/^mcpseo:\/\/seo\//);
    expect(result.coverage).toMatchObject({ returned: 1, total: 2 });
  });

  it("compare_keyword_coverage: asks for the competitor's keywords the domain lacks, and lists them", async () => {
    const result = await compareKeywordCoverage.handler({ domain: "semrush.com", competitors: ["ahrefs.com"] }, env);
    expect(requests[0]!.body).toMatchObject({ target1: "ahrefs.com", target2: "semrush.com", intersections: false });
    expect(result.facts.map((f) => [f.data.keyword, f.data.competitor_position])).toEqual([
      ["seo open source", 44],
      ["source seo", 17]
    ]);
  });

  it("inspect_page: reports the real ranking total, not the rows fetched", async () => {
    const result = await inspectPage.handler({ url: "https://dataforseo.com/" }, env);
    expect(result.facts.find((f) => f.type === "seo.top_page")?.data.ranked_keyword_count).toBe(11925);
    expect(requests[0]!.body.filters).toEqual(["ranked_serp_element.serp_item.relative_url", "=", "/"]);
  });

  it("inspect_search_visibility: organic position comes from rank_group", async () => {
    const result = await inspectSearchVisibility.handler({ domain: "dataforseo.com", keywords: ["1000 keywords"] }, env);
    const ranking = result.facts.find((f) => f.data.keyword === "1000 keywords");
    expect(ranking?.data).toMatchObject({ ranking: true, position: 1 }); // rank_group 1, even though rank_absolute is 2
  });

  it("inspect_search_visibility: says explicitly when a keyword isn't ranking, and lists it as an entity", async () => {
    const result = await inspectSearchVisibility.handler({ domain: "dataforseo.com", keywords: ["not in the fixture"] }, env);
    expect(result.facts.find((f) => f.data.keyword === "not in the fixture")?.data).toMatchObject({ ranking: false, position: null });
    expect(result.entities.some((e) => e.label === "not in the fixture")).toBe(true);
  });

  it("inspect_keyword: volume, difficulty and intent from the overview, positions from the live results", async () => {
    const result = await inspectKeyword.handler({ keyword: "seo tools" }, env);
    expect(result.data).toMatchObject({ keyword_difficulty: 54, search_intent: "informational" });
    expect(result.data.search_volume).not.toBeNull();
    const organic = result.facts.filter((f) => f.type === "serp.result").map((f) => f.data.position);
    expect(organic.slice(0, 3)).toEqual([1, 2, 3]);
  });
});

describe("the live SERP tool", () => {
  it("numbers organic results 1, 2, 3 even with features in between, and ties every fact to the keyword", async () => {
    const result = await inspectSerp.handler({ keyword: "pizza", depth: 10 }, env);
    const organic = result.facts.filter((f) => f.type === "serp.result");
    expect(organic.map((f) => f.data.position).slice(0, 3)).toEqual([1, 2, 3]);
    for (const fact of result.facts) expect(fact.subject[0]).toBe("keyword:en:US:pizza");
    const feature = result.facts.find((f) => f.type === "serp.feature");
    expect(feature?.data).toHaveProperty("slot_on_page");
    const paa = result.facts.find((f) => f.data.feature_type === "people_also_ask");
    expect(paa?.data.questions).toEqual(["What is the 2 hour rule for pizza?", "What is the best pizza in the UK?", "Which flavour is best in pizza?"]);
    expect(JSON.stringify(result.facts)).not.toContain("xpath");
  });
});

describe("backlink tools", () => {
  it("inspect_backlinks: each list view reads its rows", async () => {
    const domains = await inspectBacklinks.handler({ domain: "semrush.com", view: "referring_domains", limit: 2 }, env);
    expect(domains.facts.length).toBeGreaterThan(0);
    expect(domains.facts[0]!.data.referring_domain).toEqual(expect.any(String));
    const anchors = await inspectBacklinks.handler({ domain: "semrush.com", view: "anchors", limit: 2 }, env);
    expect(anchors.facts[0]!.data.anchor).toEqual(expect.any(String));
    const links = await inspectBacklinks.handler({ domain: "semrush.com", view: "backlinks", limit: 2 }, env);
    expect(links.facts[0]!.data.url_from).toEqual(expect.any(String));
  });

  it("inspect_backlinks: the authority view doesn't claim a row limit", async () => {
    const result = await inspectBacklinks.handler({ domain: "semrush.com" }, env);
    expect(result.coverage.scope_note).toBe("view=authority");
  });

  it("compare_backlink_gap: sites linking to the competitor but not the domain, strongest first", async () => {
    const result = await compareBacklinkGap.handler({ domain: "semrush.com", competitors: ["ahrefs.com"] }, env);
    expect(requests[0]!.body).toMatchObject({ targets: { 1: "ahrefs.com" }, exclude_targets: ["semrush.com"] });
    expect(result.facts.map((f) => f.data.referring_domain)).toEqual(["saashub.com", "seokicks.de", "github.com"]);
  });

  it("compare_backlink_gap: leaves out the competitor's own sites, and exports what's past the limit", async () => {
    const result = await compareBacklinkGap.handler({ domain: "semrush.com", competitors: ["github.com"], limit: 1 }, env);
    expect(result.facts.map((f) => f.data.referring_domain)).toEqual(["saashub.com"]);
    expect(result.coverage.scope_note).toContain("1 of the companies' own sites left out");
    expect(result.resources[0]?.uri).toMatch(/^mcpseo:\/\/backlinks\//);
  });
});

describe("AI visibility tools", () => {
  it("discover_ai_citations: sends target as [{ keyword }] and reads each domain's mention totals", async () => {
    const result = await discoverAiCitations.handler({ topic: "best seo tools" }, env);
    expect(requests[0]!.body.target).toEqual([{ keyword: "best seo tools" }]);
    expect(result.facts[0]?.data).toEqual({ domain: "www.reddit.com", rank: 1, mentions: 5420, ai_search_volume: 189357 });
  });

  it("inspect_ai_visibility: one metrics call per domain, with share of voice across them", async () => {
    const result = await inspectAiVisibility.handler({ domain: "semrush.com", competitors: ["ahrefs.com"] }, env);
    expect(requests.map((r) => r.body.target)).toEqual([[{ domain: "semrush.com" }], [{ domain: "ahrefs.com" }]]);
    const you = result.facts.find((f) => f.data.is_you);
    expect(you?.data).toMatchObject({ mentions: 65637, share_of_voice: 0.5 });
  });
});

describe("costs are explained, not capped", () => {
  it("inspect_ai_visibility takes up to 5 competitors, like the other comparison tools, and says what that costs", () => {
    const five = ["b.com", "c.com", "d.com", "e.com", "f.com"];
    expect(inspectAiVisibility.inputSchema.safeParse({ domain: "a.com", competitors: five }).success).toBe(true);
    expect(inspectAiVisibility.description).toContain("$0.10 of market data per domain");
  });
});

describe("tool errors", () => {
  it("come back as an MCP error and an envelope with a stable code", () => {
    const result = toolError("connection_required", "Connect Google Analytics first.", { connection: "analytics_property" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("connection_required: Connect Google Analytics first.");
    expect(result.structuredContent).toMatchObject({
      schema_version: "ofe/1.0",
      data: { error: { code: "connection_required", connection: "analytics_property" } },
      facts: []
    });
  });
});

describe("no supplier leaks", () => {
  it("never names the provider in facts or methods", async () => {
    const result = await inspectDomain.handler({ domain: "newmouth.com" }, env);
    expect(JSON.stringify(result).toLowerCase()).not.toContain("dataforseo_labs");
    expect(result.facts.map((f) => f.provenance.method)).toContain("domain_overview");
    expect(JSON.stringify(result.facts)).not.toContain('"raw"');
  });
});
