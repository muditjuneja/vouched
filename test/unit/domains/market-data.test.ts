/// <reference types="vite/client" />
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
  "/v3/dataforseo_labs/google/keyword_suggestions/live": "keyword_suggestions",
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

// Inlined at transform time: the Workers test runtime has no access to the repo's files.
const FIXTURES = import.meta.glob<string>("../../fixtures/dataforseo/*.json", { query: "?raw", import: "default", eager: true });

function fixture(name: string): string {
  const raw = FIXTURES[`../../fixtures/dataforseo/${name}.json`];
  if (raw === undefined) throw new Error(`missing fixture ${name}.json`);
  return raw;
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

  it("research_keywords: suggestions by default, one request per seed, merged and sorted by volume", async () => {
    const result = await researchKeywords.handler({ seedKeywords: ["seo", "seo tool"] }, env);
    expect(requests.map((r) => [r.path, r.body.keyword])).toEqual([
      ["/v3/dataforseo_labs/google/keyword_suggestions/live", "seo"],
      ["/v3/dataforseo_labs/google/keyword_suggestions/live", "seo tool"]
    ]);
    // Both seeds return the same sandbox row: listed once.
    expect(result.facts.map((f) => [f.data.keyword, f.data.search_volume, f.data.keyword_difficulty, f.data.search_intent])).toEqual([
      ["seo marketing tool", 110000, 64, "commercial"]
    ]);
    expect(result.facts[0]!.provenance.method).toBe("keyword_suggestions");
  });

  it("research_keywords: ideas mode is one request for the wider category, with nothing filtered out", async () => {
    const result = await researchKeywords.handler({ seedKeywords: ["nothing"], mode: "ideas" }, env);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.body.order_by).toEqual(["keyword_info.search_volume,desc"]);
    expect(result.facts.map((f) => f.data.keyword)).toEqual(["nothing phone", "find phone", "tin can phone"]);
    expect(result.facts[0]!.provenance.method).toBe("keyword_ideas");
  });

  it("research_keywords: navigational searches go last, labelled, not dropped", async () => {
    const ideas = JSON.parse(fixture("keyword_ideas")) as { tasks: Array<{ result: Array<{ items: Array<{ keyword: string; search_intent_info: { main_intent: string } }> }> }> };
    ideas.tasks[0]!.result[0]!.items.find((i) => i.keyword === "nothing phone")!.search_intent_info.main_intent = "navigational";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(ideas), { status: 200 })));
    const result = await researchKeywords.handler({ seedKeywords: ["phone"], mode: "ideas" }, env);
    expect(result.facts.map((f) => [f.data.keyword, f.data.search_intent])).toEqual([
      ["find phone", "informational"],
      ["tin can phone", "transactional"],
      ["nothing phone", "navigational"]
    ]);
    expect(result.coverage.scope_note).toContain("1 navigational searches (people looking for one site) listed last");
  });

  it("compare_keyword_coverage: top-20 positions only, highest volume first, intent on every row", async () => {
    const result = await compareKeywordCoverage.handler({ domain: "xmit.sh", competitors: ["source.com"] }, env);
    expect(requests[0]!.body).toMatchObject({
      filters: ["first_domain_serp_element.rank_group", "<=", 20],
      order_by: ["keyword_data.keyword_info.search_volume,desc"]
    });
    // Both fixture keywords contain "source", the competitor's name: kept, since no brand guessing happens.
    expect(result.facts.map((f) => [f.data.keyword, f.data.search_intent])).toEqual([
      ["seo open source", "commercial"],
      ["source seo", "commercial"]
    ]);
  });

  it("compare_keyword_coverage: navigational searches go last, labelled, not dropped", async () => {
    const gap = JSON.parse(fixture("domain_intersection_gap")) as { tasks: Array<{ result: Array<{ items: Array<{ keyword_data: { keyword: string; search_intent_info: { main_intent: string } } }> }> }> };
    gap.tasks[0]!.result[0]!.items[0]!.keyword_data.search_intent_info.main_intent = "navigational";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(gap), { status: 200 })));
    const result = await compareKeywordCoverage.handler({ domain: "xmit.sh", competitors: ["source.com"] }, env);
    expect(result.facts.map((f) => f.data.keyword)).toEqual(["source seo", "seo open source"]);
    expect(result.coverage.scope_note).toContain("1 navigational searches (people looking for one site, often the competitor's brand) listed last");
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

  it("inspect_search_visibility: names the ranking page, as a page entity", async () => {
    const result = await inspectSearchVisibility.handler({ domain: "dataforseo.com", keywords: ["1000 keywords"] }, env);
    const url = "https://dataforseo.com/free-seo-stats/top-1000-keywords";
    expect(result.facts.find((f) => f.data.keyword === "1000 keywords")?.data.url).toBe(url);
    expect(result.entities.some((e) => e.kind === "page" && e.label === url)).toBe(true);
  });

  it("inspect_search_visibility: a live recheck counts subdomains but not lookalike domains", async () => {
    const own = await inspectSearchVisibility.handler({ domain: "wikipedia.org", keywords: ["pizza"], recheckLive: true }, env);
    expect(own.facts.find((f) => f.data.live_recheck)?.data).toMatchObject({ ranking: true, position: 2, url: "https://en.wikipedia.org/wiki/Pizza" });
    const lookalike = await inspectSearchVisibility.handler({ domain: "pedia.org", keywords: ["pizza"], recheckLive: true }, env);
    expect(lookalike.facts.find((f) => f.data.live_recheck)?.data).toMatchObject({ ranking: false, position: null, url: null });
  });

  it("inspect_search_visibility: says explicitly when a keyword isn't ranking, and lists it as an entity", async () => {
    const result = await inspectSearchVisibility.handler({ domain: "dataforseo.com", keywords: ["not in the fixture"] }, env);
    expect(result.facts.find((f) => f.data.keyword === "not in the fixture")?.data).toMatchObject({ ranking: false, position: null });
    expect(result.entities.some((e) => e.label === "not in the fixture")).toBe(true);
  });

  it("inspect_keyword: metrics from the index only, one request, and points to inspect_serp for rankings", async () => {
    const result = await inspectKeyword.handler({ keyword: "seo tools" }, env);
    expect(requests.map((r) => r.path)).toEqual(["/v3/dataforseo_labs/google/keyword_overview/live"]);
    expect(result.data).toMatchObject({ keyword_difficulty: 54, search_intent: "informational" });
    expect(result.data.search_volume).not.toBeNull();
    expect(result.facts.map((f) => [f.type, f.provenance.source_class])).toEqual([["seo.keyword_opportunity", "search_index"]]);
    expect(result.next_actions).toEqual([{ tool: "inspect_serp", args: { keyword: "seo tools" }, use_when: "to see who ranks for it on Google right now" }]);
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

  it("inspect_backlinks: list views report the provider's total, and rank says its scale", async () => {
    const domains = await inspectBacklinks.handler({ domain: "semrush.com", view: "referring_domains", limit: 2 }, env);
    expect(domains.coverage.total).toBe(36);
    expect(domains.facts[0]!.data.rank_scale).toBe(1000);
    const anchors = await inspectBacklinks.handler({ domain: "semrush.com", view: "anchors", limit: 2 }, env);
    expect(anchors.coverage.total).toBe(4016);
    const authority = await inspectBacklinks.handler({ domain: "semrush.com" }, env);
    expect(authority.facts[0]!.data.rank_scale).toBe(1000);
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

  it("inspect_ai_visibility: no share of voice without competitors to share it with", async () => {
    const result = await inspectAiVisibility.handler({ domain: "semrush.com" }, env);
    expect(result.facts[0]?.data).toMatchObject({ mentions: 65637, share_of_voice: null });
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
    // Serialized envelope as the text too, per the MCP spec, for clients that only read `content`.
    expect(JSON.parse(result.content[0]!.text)).toEqual(result.structuredContent);
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

describe("inspect_serp features", () => {
  it("lists a feature Google repeats on the page once, at its first slot", async () => {
    const related = { type: "related_searches", rank_absolute: 11, items: ["a", "b"] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status_code: 20000,
          tasks: [{ status_code: 20000, cost: 0, result: [{ items: [related, { ...related, rank_absolute: 22 }, { ...related, rank_absolute: 30, items: ["c"] }] }] }]
        })
      )
    );
    const result = await inspectSerp.handler({ keyword: "pizza" }, env);
    const features = result.facts.filter((f) => f.type === "serp.feature");
    expect(features.map((f) => f.data.slot_on_page)).toEqual([11, 30]);
  });
});
