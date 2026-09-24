export interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  constraints?: string;
  description: string;
}

export interface EmittedFactDoc {
  type: string;
  description: string;
  fields: string[];
}

export interface EmittedEntityDoc {
  kind: "domain" | "keyword" | "page" | "property" | "backlink";
  description: string;
}

export interface AgentWorkflowDoc {
  triggerPrompt: string;
  agentReasoning: string;
  followUpTools: string[];
}

export interface ProvenanceDoc {
  sourceClass: string;
  method: string;
  confidence: number;
  cacheTtl?: string;
}

export interface ToolDocumentation {
  parameters: ToolParameter[];
  dataSummary: string;
  emittedFacts: EmittedFactDoc[];
  entitiesEmitted: EmittedEntityDoc[];
  exampleCall: Record<string, unknown>;
  exampleResponse: Record<string, unknown>;
  agentWorkflow: AgentWorkflowDoc;
  provenance: ProvenanceDoc;
  errors?: string[];
  notes?: string;
}

export const TOOL_DOCS: Record<string, ToolDocumentation> = {
  describe_capabilities: {
    parameters: [],
    dataSummary: "Lists enabled domains, registered tool manifests, emitted fact types, and default location/language settings.",
    emittedFacts: [],
    entitiesEmitted: [],
    exampleCall: {},
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "core",
      data: {
        domains: ["ai_visibility", "analytics", "backlinks", "core", "gsc", "seo", "serp"],
        tools: [
          { name: "describe_capabilities", domain: "core", billing: "free", implemented: true, enabled: true },
          { name: "inspect_domain", domain: "seo", billing: "dataforseo", implemented: true, enabled: true },
          { name: "get_search_performance", domain: "gsc", billing: "free", implemented: true, enabled: true }
        ],
        fact_types: [
          "ai_visibility.brand_mentions",
          "ai_visibility.citation_source",
          "analytics.traffic_summary",
          "backlinks.backlink",
          "backlinks.domain_authority",
          "gsc.index_status",
          "gsc.performance_summary",
          "seo.domain_summary",
          "seo.keyword_ranking",
          "serp.result"
        ],
        defaults: { location: "United States", language: "English" }
      },
      facts: [],
      entities: [],
      coverage: { returned: 20, total: 20, as_of: null, scope_note: null },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "What SEO and search capabilities does this server have?",
      agentReasoning: "The model runs describe_capabilities on startup or session init to discover which domains are enabled and whether DataForSEO or Google OAuth credentials are present.",
      followUpTools: ["list_websites", "inspect_domain"]
    },
    provenance: {
      sourceClass: "core",
      method: "core.describe_capabilities",
      confidence: 1.0
    },
    notes: "Free, zero-credential discovery call. Used by autonomous agents to verify tool availability."
  },

  export_dataset: {
    parameters: [
      {
        name: "uri",
        type: "string",
        required: true,
        constraints: "Valid mcpseo:// resource URI",
        description: "A dataset URI returned in a prior tool response (e.g. mcpseo://gsc/performance/example.com) for results truncated in summary envelopes."
      }
    ],
    dataSummary: "Returns complete, unpaginated raw dataset tables persisted in R2/D1 storage.",
    emittedFacts: [],
    entitiesEmitted: [],
    exampleCall: {
      uri: "mcpseo://gsc/performance/example.com"
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "core",
      data: {
        uri: "mcpseo://gsc/performance/example.com",
        dataset: [
          { query: "open source mcp", clicks: 1420, impressions: 18500, ctr: 0.0768, position: 2.4 },
          { query: "claude code seo", clicks: 890, impressions: 12200, ctr: 0.0729, position: 3.1 },
          { query: "headless search console api", clicks: 430, impressions: 5600, ctr: 0.0767, position: 1.8 }
        ]
      },
      facts: [],
      entities: [],
      coverage: { returned: 3, total: 3, as_of: null, scope_note: "full, untruncated dataset" },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "Fetch the full unpaginated query report from the previous export link.",
      agentReasoning: "When get_search_performance or ranking tools return a resource ref because results exceed row limits, agents call export_dataset to download the full row set.",
      followUpTools: []
    },
    provenance: {
      sourceClass: "core",
      method: "core.export_dataset",
      confidence: 1.0
    },
    errors: ["NotFoundError: invalid or expired dataset URI"]
  },

  list_websites: {
    parameters: [],
    dataSummary: "Lists all tracked client websites in your workspace, along with their connected Search Console site URLs and GA4 property IDs.",
    emittedFacts: [],
    entitiesEmitted: [
      { kind: "property", description: "Website workspace entity with primary_domain and active Google connections." }
    ],
    exampleCall: {},
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "core",
      data: { connection_required: false },
      facts: [],
      entities: [
        {
          id: "urn:property:ws_987654",
          kind: "property",
          label: "Vouched Production",
          attrs: {
            primary_domain: "vouchedhq.com",
            connections: {
              search_console: "connected",
              website_analytics: "connected"
            }
          }
        }
      ],
      coverage: { returned: 1, total: 1, as_of: null, scope_note: null },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "Which websites do I have connected to Search Console and GA4?",
      agentReasoning: "Agents call list_websites first when resolving which domain to run audits, performance reports, or indexing checks against.",
      followUpTools: ["get_search_performance", "inspect_indexing", "get_website_analytics"]
    },
    provenance: {
      sourceClass: "core",
      method: "core.list_websites",
      confidence: 1.0
    }
  },

  inspect_domain: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        constraints: "Valid hostname or apex domain (e.g. stripe.com)",
        description: "The apex domain or subdomain to snapshot."
      }
    ],
    dataSummary: "High-level organic overview containing estimated traffic, ranked keyword count, top 10 keywords, and top 5 organic competitors.",
    emittedFacts: [
      { type: "seo.domain_summary", description: "Estimated monthly organic visits and total ranked keyword count.", fields: ["estimated_organic_traffic", "ranked_keyword_count", "raw"] },
      { type: "seo.keyword_ranking", description: "Top ranked organic keywords with absolute rank and monthly volume.", fields: ["keyword", "position", "search_volume"] },
      { type: "seo.top_page", description: "Aggregated organic performance and traffic for top landing pages.", fields: ["url", "total_ranked_keywords", "total_estimated_traffic"] },
      { type: "seo.competitor", description: "Top organic competitor domains and shared keyword intersections.", fields: ["competitor_domain", "shared_keyword_count"] }
    ],
    entitiesEmitted: [
      { kind: "domain", description: "Target domain and competitor domains." },
      { kind: "keyword", description: "Top organic ranking keywords." }
    ],
    exampleCall: {
      domain: "stripe.com"
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "seo",
      data: { domain: "stripe.com" },
      facts: [
        {
          type: "seo.domain_summary",
          subject: ["urn:domain:stripe.com"],
          data: { estimated_organic_traffic: 12450000, ranked_keyword_count: 842000 },
          provenance: { source_class: "search_index", method: "dataforseo_labs.domain_rank_overview", confidence: 0.75, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        },
        {
          type: "seo.keyword_ranking",
          subject: ["urn:domain:stripe.com", "urn:keyword:online+payments"],
          data: { keyword: "online payments", position: 1, search_volume: 74000 },
          provenance: { source_class: "search_index", method: "dataforseo_labs.ranked_keywords", confidence: 0.75, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        },
        {
          type: "seo.competitor",
          subject: ["urn:domain:stripe.com", "urn:domain:adyen.com"],
          data: { competitor_domain: "adyen.com", shared_keyword_count: 28400 },
          provenance: { source_class: "search_index", method: "dataforseo_labs.competitors_domain", confidence: 0.75, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:domain:stripe.com", kind: "domain", label: "stripe.com" },
        { id: "urn:keyword:online+payments", kind: "keyword", label: "online payments" },
        { id: "urn:domain:adyen.com", kind: "domain", label: "adyen.com" }
      ],
      coverage: { returned: 16, total: null, as_of: "2026-09-24T00:00:00Z", scope_note: "top 10 keywords and top 5 competitors only; use research_keywords/discover_competitors for more" },
      deltas: [],
      resources: [],
      next_actions: [
        { tool: "discover_competitors", args: { domain: "stripe.com" }, use_when: "deep competitor research is needed" },
        { tool: "research_keywords", args: { seedKeywords: ["online payments"] }, use_when: "expanding keyword demand" }
      ]
    },
    agentWorkflow: {
      triggerPrompt: "Give me an organic search snapshot of stripe.com.",
      agentReasoning: "The model runs inspect_domain to get estimated traffic volume, primary ranking keywords, and top competitors in a single compound call before drilling into specific keywords.",
      followUpTools: ["discover_competitors", "research_keywords", "inspect_backlinks"]
    },
    provenance: {
      sourceClass: "search_index",
      method: "dataforseo_labs.domain_rank_overview",
      confidence: 0.75,
      cacheTtl: "24 hours"
    },
    errors: ["QuotaExceededError: DataForSEO monthly credit exhausted"]
  },

  discover_competitors: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "The domain to find organic search competitors for."
      },
      {
        name: "limit",
        type: "number",
        required: false,
        default: "20",
        constraints: "Integer between 1 and 100",
        description: "Maximum number of competitor domains to return."
      }
    ],
    dataSummary: "Lists organic competitor domains ranked by search keyword overlap, average position, and shared keywords.",
    emittedFacts: [
      { type: "seo.competitor", description: "Competitor domain with average position and count of shared ranking keywords.", fields: ["competitor_domain", "avg_position", "shared_keyword_count", "raw"] },
      { type: "core.data_freshness", description: "Observation timestamp and search index crawl freshness.", fields: ["observed_at"] }
    ],
    entitiesEmitted: [
      { kind: "domain", description: "Target domain and each identified competitor domain." }
    ],
    exampleCall: {
      domain: "postman.com",
      limit: 10
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "seo",
      data: { domain: "postman.com" },
      facts: [
        {
          type: "seo.competitor",
          subject: ["urn:domain:postman.com", "urn:domain:insomnia.rest"],
          data: { competitor_domain: "insomnia.rest", avg_position: 8.4, shared_keyword_count: 4210 },
          provenance: { source_class: "search_index", method: "dataforseo_labs.competitors_domain", confidence: 0.75, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        },
        {
          type: "seo.competitor",
          subject: ["urn:domain:postman.com", "urn:domain:hoppscotch.io"],
          data: { competitor_domain: "hoppscotch.io", avg_position: 12.1, shared_keyword_count: 1840 },
          provenance: { source_class: "search_index", method: "dataforseo_labs.competitors_domain", confidence: 0.75, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:domain:postman.com", kind: "domain", label: "postman.com" },
        { id: "urn:domain:insomnia.rest", kind: "domain", label: "insomnia.rest" },
        { id: "urn:domain:hoppscotch.io", kind: "domain", label: "hoppscotch.io" }
      ],
      coverage: { returned: 2, total: null, as_of: "2026-09-24T00:00:00Z", scope_note: null },
      deltas: [],
      resources: [],
      next_actions: [
        { tool: "compare_keyword_coverage", args: { domain: "postman.com", competitors: ["insomnia.rest", "hoppscotch.io"] }, use_when: "find missing keyword opportunities" }
      ]
    },
    agentWorkflow: {
      triggerPrompt: "Who are postman.com's primary SEO competitors?",
      agentReasoning: "The agent queries discover_competitors to extract high-overlap competitor domains, which are then passed directly into compare_keyword_coverage and compare_backlink_gap.",
      followUpTools: ["compare_keyword_coverage", "compare_backlink_gap"]
    },
    provenance: {
      sourceClass: "search_index",
      method: "dataforseo_labs.competitors_domain",
      confidence: 0.75
    }
  },

  research_keywords: {
    parameters: [
      {
        name: "seedKeywords",
        type: "string[]",
        required: true,
        constraints: "Array of 1 to 20 search query strings",
        description: "One or more seed terms to expand into a ranked demand list."
      },
      {
        name: "limit",
        type: "number",
        required: false,
        default: "50",
        constraints: "Integer between 1 and 200",
        description: "Maximum number of keyword suggestions to return."
      }
    ],
    dataSummary: "Keyword ideas with monthly search volume, cost-per-click (CPC), paid competition index, and organic keyword difficulty.",
    emittedFacts: [
      { type: "seo.keyword_opportunity", description: "Search demand metrics for an expanded keyword idea.", fields: ["keyword", "search_volume", "cpc", "competition", "keyword_difficulty", "raw"] }
    ],
    entitiesEmitted: [
      { kind: "keyword", description: "Discovered search queries." }
    ],
    exampleCall: {
      seedKeywords: ["mcp server", "model context protocol"],
      limit: 25
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "seo",
      data: { seed_keywords: ["mcp server", "model context protocol"] },
      facts: [
        {
          type: "seo.keyword_opportunity",
          subject: ["urn:keyword:mcp+server+examples"],
          data: { keyword: "mcp server examples", search_volume: 4800, cpc: 2.15, competition: 0.34, keyword_difficulty: 28 },
          provenance: { source_class: "search_index", method: "dataforseo_labs.keyword_ideas", confidence: 0.75, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        },
        {
          type: "seo.keyword_opportunity",
          subject: ["urn:keyword:best+mcp+servers+for+claude"],
          data: { keyword: "best mcp servers for claude", search_volume: 3200, cpc: 3.40, competition: 0.41, keyword_difficulty: 35 },
          provenance: { source_class: "search_index", method: "dataforseo_labs.keyword_ideas", confidence: 0.75, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:keyword:mcp+server+examples", kind: "keyword", label: "mcp server examples" },
        { id: "urn:keyword:best+mcp+servers+for+claude", kind: "keyword", label: "best mcp servers for claude" }
      ],
      coverage: { returned: 2, total: null, as_of: "2026-09-24T00:00:00Z", scope_note: null },
      deltas: [],
      resources: [],
      next_actions: [
        { tool: "inspect_serp", args: { keyword: "mcp server examples" }, use_when: "inspect live rankings for top terms" }
      ]
    },
    agentWorkflow: {
      triggerPrompt: "Find keyword ideas and search volume around 'model context protocol'.",
      agentReasoning: "The agent generates related keyword opportunities with difficulty and volume metrics, filtering for high-intent, low-difficulty terms.",
      followUpTools: ["inspect_keyword", "inspect_serp"]
    },
    provenance: {
      sourceClass: "search_index",
      method: "dataforseo_labs.keyword_ideas",
      confidence: 0.75
    }
  },

  compare_keyword_coverage: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "Your primary domain to evaluate."
      },
      {
        name: "competitors",
        type: "string[]",
        required: true,
        constraints: "Array of 1 to 5 competitor domain strings",
        description: "Competitor domains to find keyword gaps against."
      }
    ],
    dataSummary: "Pairwise keyword intersections identifying queries where competitors rank but you do not ('competitor_only') or where you rank and they do not ('you_only').",
    emittedFacts: [
      { type: "seo.keyword_opportunity", description: "Keyword gap with relative ranking positions and gap direction.", fields: ["keyword", "gap_direction", "your_position", "competitor_position", "raw"] }
    ],
    entitiesEmitted: [
      { kind: "domain", description: "Your domain and each competitor domain." },
      { kind: "keyword", description: "Discovered gap keywords." }
    ],
    exampleCall: {
      domain: "vouchedhq.com",
      competitors: ["semrush.com"]
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "seo",
      data: { domain: "vouchedhq.com", competitors: ["semrush.com"] },
      facts: [
        {
          type: "seo.keyword_opportunity",
          subject: ["urn:domain:vouchedhq.com", "urn:domain:semrush.com", "urn:keyword:open+source+semrush"],
          data: { keyword: "open source semrush", gap_direction: "competitor_only", your_position: null, competitor_position: 4 },
          provenance: { source_class: "search_index", method: "dataforseo_labs.domain_intersection", confidence: 0.75, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:domain:vouchedhq.com", kind: "domain", label: "vouchedhq.com" },
        { id: "urn:domain:semrush.com", kind: "domain", label: "semrush.com" },
        { id: "urn:keyword:open+source+semrush", kind: "keyword", label: "open source semrush" }
      ],
      coverage: { returned: 1, total: null, as_of: "2026-09-24T00:00:00Z", scope_note: null },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "Which keywords does semrush.com rank for that vouchedhq.com is missing?",
      agentReasoning: "The agent uses compare_keyword_coverage to find immediate content and landing page expansion opportunities by analyzing competitor ranking gaps.",
      followUpTools: ["inspect_keyword", "inspect_serp"]
    },
    provenance: {
      sourceClass: "search_index",
      method: "dataforseo_labs.domain_intersection",
      confidence: 0.75
    }
  },

  inspect_search_visibility: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "Target domain to check visibility and ranking positions for."
      },
      {
        name: "keywords",
        type: "string[]",
        required: true,
        constraints: "Array of 1 to 50 search queries",
        description: "Exact list of keywords to check ranking positions against."
      },
      {
        name: "recheckLive",
        type: "boolean",
        required: false,
        default: "false",
        constraints: "Caps live checks at top 10 keywords",
        description: "Also live-check current Google SERP positions for up to 10 of these keywords (incurs live SERP API credits)."
      }
    ],
    dataSummary: "Current ranking positions across an explicit list of target keywords, with optional real-time live SERP verification.",
    emittedFacts: [
      { type: "seo.keyword_ranking", description: "Absolute ranking position for target keyword.", fields: ["keyword", "position", "source"] },
      { type: "core.data_freshness", description: "Timestamp and freshness metadata for live rechecks.", fields: ["recheck_live", "checked_at"] }
    ],
    entitiesEmitted: [
      { kind: "domain", description: "Target domain." },
      { kind: "keyword", description: "Checked keyword queries." }
    ],
    exampleCall: {
      domain: "resend.com",
      keywords: ["transactional email api", "smtp relay developer"],
      recheckLive: true
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "seo",
      data: { domain: "resend.com", keywords: ["transactional email api", "smtp relay developer"] },
      facts: [
        {
          type: "seo.keyword_ranking",
          subject: ["urn:domain:resend.com", "urn:keyword:transactional+email+api"],
          data: { keyword: "transactional email api", position: 1, source: "live_serp" },
          provenance: { source_class: "live_serp", method: "serp.google.organic.live.advanced", confidence: 0.85, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:domain:resend.com", kind: "domain", label: "resend.com" },
        { id: "urn:keyword:transactional+email+api", kind: "keyword", label: "transactional email api" }
      ],
      coverage: { returned: 1, total: 2, as_of: "2026-09-24T00:00:00Z", scope_note: null },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "Check if resend.com ranks on page 1 for 'transactional email api' with live SERP verification.",
      agentReasoning: "When verifying critical business keywords, the agent activates recheckLive: true to confirm real-time positions rather than relying on cached index crawls.",
      followUpTools: ["inspect_serp"]
    },
    provenance: {
      sourceClass: "live_serp",
      method: "serp.google.organic.live.advanced",
      confidence: 0.85
    }
  },

  inspect_keyword: {
    parameters: [
      {
        name: "keyword",
        type: "string",
        required: true,
        description: "The keyword to inspect."
      }
    ],
    dataSummary: "Detailed keyword metrics (search volume, CPC, competition score, difficulty, search intent) and the top 20 Google organic results and SERP features.",
    emittedFacts: [
      { type: "serp.result", description: "Organic ranking entry with page URL, domain, title, and position.", fields: ["position", "domain", "url", "title"] },
      { type: "serp.feature", description: "SERP features present (featured snippet, PAA, knowledge graph, video carousel).", fields: ["feature_type", "position"] }
    ],
    entitiesEmitted: [
      { kind: "keyword", description: "Target search query." },
      { kind: "domain", description: "Domains appearing in the SERP." },
      { kind: "page", description: "URLs ranking in top results." }
    ],
    exampleCall: {
      keyword: "open source mcp server"
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "seo",
      data: {
        keyword: "open source mcp server",
        search_volume: 2400,
        cpc: 1.85,
        competition: 0.28,
        keyword_difficulty: 24,
        search_intent: "informational"
      },
      facts: [
        {
          type: "serp.result",
          subject: ["urn:page:https%3A%2F%2Fgithub.com%2Fmodelcontextprotocol"],
          data: { position: 1, domain: "github.com", url: "https://github.com/modelcontextprotocol", title: "Model Context Protocol Specification and Servers" },
          provenance: { source_class: "live_serp", method: "serp.google.organic.live.advanced", confidence: 0.85, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:keyword:open+source+mcp+server", kind: "keyword", label: "open source mcp server" },
        { id: "urn:domain:github.com", kind: "domain", label: "github.com" },
        { id: "urn:page:https%3A%2F%2Fgithub.com%2Fmodelcontextprotocol", kind: "page", label: "https://github.com/modelcontextprotocol" }
      ],
      coverage: { returned: 1, total: 20, as_of: "2026-09-24T00:00:00Z", scope_note: null },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "Analyze the keyword 'open source mcp server': who ranks #1 and what is search intent?",
      agentReasoning: "The agent inspects commercial intent, volume, and ranking URLs before writing or recommending content optimization changes.",
      followUpTools: ["inspect_page", "inspect_serp"]
    },
    provenance: {
      sourceClass: "live_serp",
      method: "serp.google.organic.live.advanced",
      confidence: 0.85
    }
  },

  inspect_page: {
    parameters: [
      {
        name: "url",
        type: "string",
        required: true,
        constraints: "Fully-qualified URL (e.g. https://stripe.com/pricing)",
        description: "The page URL to inspect."
      }
    ],
    dataSummary: "List of organic keywords that rank for this exact page URL, along with position, search volume, and estimated traffic.",
    emittedFacts: [
      { type: "seo.keyword_ranking", description: "Keywords sending traffic to this specific URL.", fields: ["keyword", "position", "search_volume", "estimated_traffic", "raw"] },
      { type: "seo.top_page", description: "Aggregated organic performance for the page.", fields: ["url", "total_ranked_keywords", "total_estimated_traffic"] }
    ],
    entitiesEmitted: [
      { kind: "page", description: "Target URL entity." },
      { kind: "domain", description: "Parent domain." },
      { kind: "keyword", description: "Ranking search queries." }
    ],
    exampleCall: {
      url: "https://stripe.com/pricing"
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "seo",
      data: { url: "https://stripe.com/pricing" },
      facts: [
        {
          type: "seo.keyword_ranking",
          subject: ["urn:page:https%3A%2F%2Fstripe.com%2Fpricing", "urn:keyword:stripe+fees"],
          data: { keyword: "stripe fees", position: 1, search_volume: 49500, estimated_traffic: 18200 },
          provenance: { source_class: "search_index", method: "dataforseo_labs.ranked_keywords", confidence: 0.75, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        },
        {
          type: "seo.top_page",
          subject: ["urn:page:https%3A%2F%2Fstripe.com%2Fpricing"],
          data: { url: "https://stripe.com/pricing", total_ranked_keywords: 310, total_estimated_traffic: 84000 },
          provenance: { source_class: "search_index", method: "dataforseo_labs.ranked_keywords", confidence: 0.75, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:page:https%3A%2F%2Fstripe.com%2Fpricing", kind: "page", label: "https://stripe.com/pricing" },
        { id: "urn:domain:stripe.com", kind: "domain", label: "stripe.com" },
        { id: "urn:keyword:stripe+fees", kind: "keyword", label: "stripe fees" }
      ],
      coverage: { returned: 2, total: null, as_of: "2026-09-24T00:00:00Z", scope_note: null },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "Which search queries drive the most traffic to stripe.com/pricing?",
      agentReasoning: "The agent uses inspect_page to isolate all ranking queries on a specific URL to identify cannibalization or keyword consolidation opportunities.",
      followUpTools: ["inspect_indexing"]
    },
    provenance: {
      sourceClass: "search_index",
      method: "dataforseo_labs.ranked_keywords",
      confidence: 0.75
    }
  },

  inspect_serp: {
    parameters: [
      {
        name: "keyword",
        type: "string",
        required: true,
        description: "The search query to snapshot."
      },
      {
        name: "depth",
        type: "number",
        required: false,
        default: "20",
        constraints: "Integer between 1 and 100",
        description: "How many organic results deep to snapshot."
      }
    ],
    dataSummary: "Live Google search results snapshot returning both organic positions and non-organic SERP furniture (featured snippets, People Also Ask, AI Overviews).",
    emittedFacts: [
      { type: "serp.result", description: "Organic web result position, ranking domain, URL, and snippet title.", fields: ["position", "domain", "url", "title"] },
      { type: "serp.feature", description: "Special SERP features (featured_snippet, people_also_ask, ai_overview).", fields: ["feature_type", "position", "domain", "title"] }
    ],
    entitiesEmitted: [
      { kind: "domain", description: "Domains appearing on the SERP." },
      { kind: "page", description: "Individual URLs appearing on the SERP." }
    ],
    exampleCall: {
      keyword: "claude code mcp setup",
      depth: 20
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "serp",
      data: { keyword: "claude code mcp setup", items_count: 14 },
      facts: [
        {
          type: "serp.result",
          subject: ["urn:page:https%3A%2F%2Fdocs.anthropic.com%2Fclaude-code%2Fmcp"],
          data: { position: 1, domain: "docs.anthropic.com", url: "https://docs.anthropic.com/claude-code/mcp", title: "Model Context Protocol in Claude Code" },
          provenance: { source_class: "live_serp", method: "serp.google.organic.live.advanced", confidence: 0.85, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        },
        {
          type: "serp.feature",
          subject: ["urn:domain:docs.anthropic.com"],
          data: { feature_type: "featured_snippet", position: 1, domain: "docs.anthropic.com", title: "Quickstart Guide" },
          provenance: { source_class: "live_serp", method: "serp.google.organic.live.advanced", confidence: 0.65, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:domain:docs.anthropic.com", kind: "domain", label: "docs.anthropic.com" },
        { id: "urn:page:https%3A%2F%2Fdocs.anthropic.com%2Fclaude-code%2Fmcp", kind: "page", label: "https://docs.anthropic.com/claude-code/mcp" }
      ],
      coverage: { returned: 2, total: 14, as_of: "2026-09-24T00:00:00Z", scope_note: null },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "Snapshot the live Google SERP for 'claude code mcp setup' and check if there is an AI Overview.",
      agentReasoning: "The agent inspects live search results to verify ranking changes, presence of featured snippets, or displacement by AI Overviews in real time.",
      followUpTools: ["discover_ai_citations"]
    },
    provenance: {
      sourceClass: "live_serp",
      method: "serp.google.organic.live.advanced",
      confidence: 0.85
    }
  },

  audit_site: {
    parameters: [
      {
        name: "url",
        type: "string",
        required: true,
        constraints: "Valid website URL (e.g. https://example.com)",
        description: "The site to audit."
      },
      {
        name: "maxPages",
        type: "number",
        required: false,
        default: "50",
        constraints: "Integer between 1 and 200",
        description: "Page cap for this crawl."
      }
    ],
    dataSummary: "Crawl health audit returning overall health score (0-100), clustered technical issues, and per-page issues (broken links, missing meta, heading structure).",
    emittedFacts: [
      { type: "audit.site_health", description: "Aggregated site health score, pages scanned count, and total issues.", fields: ["score", "pages_scanned", "total_issues"] },
      { type: "audit.issue_cluster", description: "Clustered technical issue group with severity and affected count.", fields: ["cluster_id", "issue_type", "count", "severity", "affected_urls"] },
      { type: "audit.crawl_issue", description: "Specific issue observed on a single crawled URL.", fields: ["page_url", "issue_type", "severity", "details"] }
    ],
    entitiesEmitted: [
      { kind: "domain", description: "Audited domain." },
      { kind: "page", description: "Crawled pages." }
    ],
    exampleCall: {
      url: "https://example.com",
      maxPages: 25
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "audit",
      data: { url: "https://example.com", pages_scanned: 25, max_pages: 25, truncated: false },
      facts: [
        {
          type: "audit.site_health",
          subject: ["urn:domain:example.com"],
          data: { score: 92, pages_scanned: 25, total_issues: 3 },
          provenance: { source_class: "crawl", method: "self_crawl.site_health", confidence: 0.80, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:domain:example.com", kind: "domain", label: "example.com" }
      ],
      coverage: { returned: 1, total: 25, as_of: "2026-09-24T00:00:00Z", scope_note: "Held back in MCP server until Workers queue crawler rework completes." },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "Run a health crawl of example.com.",
      agentReasoning: "Tool is built (src/domains/audit/audit-site.ts) but held back from active MCP registration (implemented: false) until asynchronous Workers queue crawling replaces synchronous loops.",
      followUpTools: ["inspect_indexing"]
    },
    provenance: {
      sourceClass: "crawl",
      method: "self_crawl.site_health",
      confidence: 0.80
    },
    notes: "Roadmap notice: Unregistered in MCP server to prevent Cloudflare Worker CPU/subrequest exhaustion. Use inspect_indexing for verified Google indexing status."
  },

  inspect_backlinks: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "Target domain to inspect inbound links for."
      },
      {
        name: "view",
        type: "enum",
        required: false,
        default: "authority",
        constraints: "authority | referring_domains | anchors | backlinks",
        description: "Which slice to fetch (authority = domain score; referring_domains = top linking domains; anchors = anchor text distribution; backlinks = individual link URLs)."
      },
      {
        name: "limit",
        type: "number",
        required: false,
        default: "50",
        constraints: "Integer between 1 and 500",
        description: "Maximum entries to return for list views."
      }
    ],
    dataSummary: "One domain's link profile sliced by view: authority rank, referring domains, anchor text distribution, or individual backlink URLs.",
    emittedFacts: [
      { type: "backlinks.domain_authority", description: "DataForSEO domain rank, backlink count, and referring domain count.", fields: ["rank", "backlinks", "referring_domains", "referring_main_domains"] },
      { type: "backlinks.referring_domain", description: "Referring domain with authority rank and backlink count.", fields: ["referring_domain", "backlinks_count", "domain_rank"] },
      { type: "backlinks.anchor", description: "Anchor text and referring domain count.", fields: ["anchor", "backlinks_count", "referring_domains_count"] },
      { type: "backlinks.backlink", description: "Individual backlink with target URL, source URL, anchor, and dofollow status.", fields: ["from_domain", "from_url", "to_url", "anchor", "dofollow", "first_seen"] }
    ],
    entitiesEmitted: [
      { kind: "domain", description: "Target domain and referring domains." },
      { kind: "backlink", description: "Individual backlink entities when view is 'backlinks'." }
    ],
    exampleCall: {
      domain: "github.com",
      view: "authority"
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "backlinks",
      data: { domain: "github.com", view: "authority" },
      facts: [
        {
          type: "backlinks.domain_authority",
          subject: ["urn:domain:github.com"],
          data: { rank: 98, backlinks: 1420000000, referring_domains: 4800000, referring_main_domains: 4100000 },
          provenance: { source_class: "backlink_index", method: "dataforseo_backlinks.summary", confidence: 0.80, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:domain:github.com", kind: "domain", label: "github.com" }
      ],
      coverage: { returned: 1, total: 1, as_of: "2026-09-24T00:00:00Z", scope_note: "Single-view fetch keeps vendor API consumption strictly at 1 call." },
      deltas: [],
      resources: [],
      next_actions: [
        { tool: "inspect_backlinks", args: { domain: "github.com", view: "referring_domains" }, use_when: "inspect top referring root domains" }
      ]
    },
    agentWorkflow: {
      triggerPrompt: "Inspect github.com's domain authority score and backlink counts.",
      agentReasoning: "The agent defaults to view: 'authority' for cheap broad stats, then requests view: 'referring_domains' or 'backlinks' only if deep link acquisition analysis is requested.",
      followUpTools: ["compare_backlink_gap"]
    },
    provenance: {
      sourceClass: "backlink_index",
      method: "dataforseo_backlinks.summary",
      confidence: 0.80
    }
  },

  compare_backlink_gap: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "Your domain to compare."
      },
      {
        name: "competitors",
        type: "string[]",
        required: true,
        constraints: "Array of 1 to 5 competitor domains",
        description: "Competitor domains to find link gaps against."
      }
    ],
    dataSummary: "Discovers referring domains linking to competitors but not to your domain. Automatically filters out spam domains (spam_score > 30) and flags earned links.",
    emittedFacts: [
      { type: "backlinks.link_gap", description: "Referring domain gap with spam score, domain rank, and gap direction.", fields: ["referring_domain", "domain_rank", "spam_score", "gap_direction", "earned_link"] }
    ],
    entitiesEmitted: [
      { kind: "domain", description: "Your domain, competitors, and discovered referring domains." }
    ],
    exampleCall: {
      domain: "vouchedhq.com",
      competitors: ["semrush.com"]
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "backlinks",
      data: { domain: "vouchedhq.com", competitors: ["semrush.com"] },
      facts: [
        {
          type: "backlinks.link_gap",
          subject: ["urn:domain:vouchedhq.com", "urn:domain:semrush.com", "urn:domain:techcrunch.com"],
          data: { referring_domain: "techcrunch.com", domain_rank: 88, spam_score: 2, gap_direction: "competitor_only", earned_link: true },
          provenance: { source_class: "backlink_index", method: "dataforseo_backlinks.domain_intersection", confidence: 0.80, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:domain:vouchedhq.com", kind: "domain", label: "vouchedhq.com" },
        { id: "urn:domain:semrush.com", kind: "domain", label: "semrush.com" },
        { id: "urn:domain:techcrunch.com", kind: "domain", label: "techcrunch.com" }
      ],
      coverage: { returned: 1, total: null, as_of: "2026-09-24T00:00:00Z", scope_note: "Filtered out domains with spam score > 30." },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "Find high-authority websites that link to semrush.com but not to vouchedhq.com.",
      agentReasoning: "The agent runs compare_backlink_gap to identify reputable outreach and PR opportunities, trusting Vouched's built-in spam filter to purge low-quality directories.",
      followUpTools: ["inspect_backlinks"]
    },
    provenance: {
      sourceClass: "backlink_index",
      method: "dataforseo_backlinks.domain_intersection",
      confidence: 0.80
    }
  },

  discover_ai_citations: {
    parameters: [
      {
        name: "topic",
        type: "string",
        required: true,
        description: "The category or topic to check AI-citation sources for."
      },
      {
        name: "platform",
        type: "enum",
        required: false,
        default: "google",
        constraints: "google | chat_gpt",
        description: "google = Google AI Overview; chat_gpt = ChatGPT Search."
      }
    ],
    dataSummary: "Lists the most frequently cited domains in generative AI answers (Google AI Overviews and ChatGPT) for a given market vertical.",
    emittedFacts: [
      { type: "ai_visibility.citation_source", description: "Domain cited in AI answers with mention count and citation rank.", fields: ["domain", "mentions", "rank", "raw"] },
      { type: "core.data_freshness", description: "Observation timestamp and platform identifier.", fields: ["platform", "observed_at"] }
    ],
    entitiesEmitted: [
      { kind: "domain", description: "Cited source domains." }
    ],
    exampleCall: {
      topic: "developer productivity tools",
      platform: "google"
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "ai_visibility",
      data: { topic: "developer productivity tools", platform: "google" },
      facts: [
        {
          type: "ai_visibility.citation_source",
          subject: ["urn:domain:linear.app"],
          data: { domain: "linear.app", mentions: 18, rank: 1 },
          provenance: { source_class: "ai_answer", method: "ai_optimization.llm_mentions.top_mentioned_domains", confidence: 0.50, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:domain:linear.app", kind: "domain", label: "linear.app" }
      ],
      coverage: { returned: 1, total: null, as_of: "2026-09-24T00:00:00Z", scope_note: null },
      deltas: [],
      resources: [],
      next_actions: [
        { tool: "inspect_ai_visibility", args: { domain: "linear.app" }, use_when: "inspect brand share of voice vs competitors" }
      ]
    },
    agentWorkflow: {
      triggerPrompt: "Which sources does Google AI Overview cite most often for 'developer productivity tools'?",
      agentReasoning: "The agent identifies top authoritative domains cited by LLM answer engines, which informs content syndication and digital PR strategies.",
      followUpTools: ["inspect_ai_visibility"]
    },
    provenance: {
      sourceClass: "ai_answer",
      method: "ai_optimization.llm_mentions.top_mentioned_domains",
      confidence: 0.50
    },
    notes: "Experimental endpoint. AI answer citation presence fluctuates more than deterministic search index ranks."
  },

  inspect_ai_visibility: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "Your domain to measure AI brand mentions for."
      },
      {
        name: "competitors",
        type: "string[]",
        required: false,
        constraints: "Array of up to 5 competitor domains",
        description: "Named competitor domains to compare against."
      },
      {
        name: "platform",
        type: "enum",
        required: false,
        default: "google",
        constraints: "google | chat_gpt",
        description: "AI platform to inspect (google = AI Overview; chat_gpt = ChatGPT)."
      }
    ],
    dataSummary: "Compares how frequently your domain is mentioned in generative AI answers compared to named competitors, including share-of-voice calculations.",
    emittedFacts: [
      { type: "ai_visibility.brand_mentions", description: "Brand mention frequency, is_you flag, and share of voice percentage.", fields: ["domain", "is_you", "mentions", "share_of_voice", "raw"] }
    ],
    entitiesEmitted: [
      { kind: "domain", description: "Target domain and competitor domains." }
    ],
    exampleCall: {
      domain: "linear.app",
      competitors: ["jira.com", "asana.com"],
      platform: "google"
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "ai_visibility",
      data: { domain: "linear.app", competitors: ["jira.com", "asana.com"], platform: "google" },
      facts: [
        {
          type: "ai_visibility.brand_mentions",
          subject: ["urn:domain:linear.app"],
          data: { domain: "linear.app", is_you: true, mentions: 42, share_of_voice: 0.38 },
          provenance: { source_class: "ai_answer", method: "ai_optimization.llm_mentions.search_mentions", confidence: 0.50, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        },
        {
          type: "ai_visibility.brand_mentions",
          subject: ["urn:domain:jira.com"],
          data: { domain: "jira.com", is_you: false, mentions: 51, share_of_voice: 0.46 },
          provenance: { source_class: "ai_answer", method: "ai_optimization.llm_mentions.search_mentions", confidence: 0.50, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:domain:linear.app", kind: "domain", label: "linear.app" },
        { id: "urn:domain:jira.com", kind: "domain", label: "jira.com" }
      ],
      coverage: { returned: 2, total: 3, as_of: "2026-09-24T00:00:00Z", scope_note: null },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "What is linear.app's share of voice in Google AI Overviews compared to jira.com?",
      agentReasoning: "The agent compares multi-brand presence in generative search to quantify LLM visibility changes over time.",
      followUpTools: ["discover_ai_citations"]
    },
    provenance: {
      sourceClass: "ai_answer",
      method: "ai_optimization.llm_mentions.search_mentions",
      confidence: 0.50
    }
  },

  get_search_performance: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "A tracked website's primary_domain (e.g. example.com)."
      },
      {
        name: "startDate",
        type: "string",
        required: true,
        constraints: "ISO date format: YYYY-MM-DD",
        description: "Start of date range (up to 16 months back from Google Search Console)."
      },
      {
        name: "endDate",
        type: "string",
        required: true,
        constraints: "ISO date format: YYYY-MM-DD",
        description: "End of date range."
      },
      {
        name: "dimensions",
        type: "enum[]",
        required: false,
        default: '["query"]',
        constraints: "1 to 3 items from: query | page | date | hour | country | device | searchAppearance",
        description: "Break rows down by up to 3 dimensions in order (e.g. ['query', 'device'] cross-tabs queries by device)."
      },
      {
        name: "rowLimit",
        type: "number",
        required: false,
        default: "25",
        constraints: "Integer between 1 and 1000",
        description: "Max rows to return in the immediate envelope (overflow saved to mcpseo:// export dataset)."
      },
      {
        name: "startRow",
        type: "number",
        required: false,
        default: "0",
        constraints: "Integer min 0",
        description: "Zero-based row offset for pagination past one rowLimit page."
      },
      {
        name: "searchType",
        type: "enum",
        required: false,
        default: "web",
        constraints: "web | image | video | news | googleNews | discover",
        description: "Which search surface to report on (web = combined web search; discover = Google Discover feed traffic)."
      },
      {
        name: "dataState",
        type: "enum",
        required: false,
        default: "final",
        constraints: "final | all",
        description: "'final': settled data only. 'all': includes provisional data from the last 24–48 hours."
      },
      {
        name: "device",
        type: "enum",
        required: false,
        constraints: "DESKTOP | MOBILE | TABLET",
        description: "Restrict results to one device category."
      },
      {
        name: "country",
        type: "string",
        required: false,
        constraints: "3-character ISO-3166-1 alpha-3 code (e.g. usa, gbr, deu)",
        description: "Restrict results to one country."
      },
      {
        name: "queryContains",
        type: "string",
        required: false,
        description: "Convenience filter: restrict to queries containing this substring."
      },
      {
        name: "pageContains",
        type: "string",
        required: false,
        description: "Convenience filter: restrict to URLs containing this substring."
      },
      {
        name: "compareToPreviousPeriod",
        type: "boolean",
        required: false,
        default: "false",
        description: "Fetches equal-length preceding period and computes deltas for clicks, impressions, CTR, and position."
      }
    ],
    dataSummary: "First-party Google Search Console performance data (confidence 1.0) with total clicks, impressions, average CTR, average position, and row breakdowns.",
    emittedFacts: [
      { type: "gsc.performance_summary", description: "Aggregated period totals for clicks, impressions, CTR, and average position.", fields: ["clicks", "impressions", "ctr", "position", "start_date", "end_date"] },
      { type: "gsc.query_performance", description: "Per-query or per-dimension performance metrics with optional period-over-period deltas.", fields: ["query", "page", "clicks", "impressions", "ctr", "position", "delta"] }
    ],
    entitiesEmitted: [
      { kind: "property", description: "Tracked Search Console property." },
      { kind: "keyword", description: "Reported search queries." },
      { kind: "page", description: "Reported landing page URLs." }
    ],
    exampleCall: {
      domain: "example.com",
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      dimensions: ["query"],
      compareToPreviousPeriod: true,
      rowLimit: 25
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "gsc",
      data: {
        domain: "example.com",
        startDate: "2026-08-01",
        endDate: "2026-08-28",
        dimensions: ["query"],
        totals: { clicks: 14250, impressions: 310000, ctr: 0.0459, position: 8.2 },
        deltas: { clicks: 1250, impressions: 24000, ctr: 0.0018, position: -0.4 }
      },
      facts: [
        {
          type: "gsc.performance_summary",
          subject: ["urn:property:ws_12345"],
          data: { clicks: 14250, impressions: 310000, ctr: 0.0459, position: 8.2, start_date: "2026-08-01", end_date: "2026-08-28" },
          provenance: { source_class: "webmaster_console", method: "searchconsole.searchanalytics.query", confidence: 1.0, observed_at: "2026-09-24T00:00:00Z", cache_hit: true }
        },
        {
          type: "gsc.query_performance",
          subject: ["urn:property:ws_12345", "urn:keyword:open+source+seo+mcp"],
          data: { query: "open source seo mcp", clicks: 3820, impressions: 42000, ctr: 0.0909, position: 1.4, delta: { clicks: 450, position: -0.2 } },
          provenance: { source_class: "webmaster_console", method: "searchconsole.searchanalytics.query", confidence: 1.0, observed_at: "2026-09-24T00:00:00Z", cache_hit: true }
        }
      ],
      entities: [
        { id: "urn:property:ws_12345", kind: "property", label: "Example Prod" },
        { id: "urn:keyword:open+source+seo+mcp", kind: "keyword", label: "open source seo mcp" }
      ],
      coverage: { returned: 25, total: 420, as_of: "2026-08-28", scope_note: "Top 25 rows shown; full 420 rows available via resources URI." },
      deltas: [],
      resources: [
        { uri: "mcpseo://gsc/performance/example.com", description: "Full 420 query rows export" }
      ],
      next_actions: [
        { tool: "export_dataset", args: { uri: "mcpseo://gsc/performance/example.com" }, use_when: "full unpaginated table is needed" },
        { tool: "inspect_indexing", args: { domain: "example.com", url: "https://example.com/blog/mcp" }, use_when: "inspect index health for declining URLs" }
      ]
    },
    agentWorkflow: {
      triggerPrompt: "Why did organic search clicks drop for example.com over the last 28 days?",
      agentReasoning: "The agent calls get_search_performance with compareToPreviousPeriod: true to identify exact queries and pages with negative click and CTR deltas with 1.0 ground-truth confidence.",
      followUpTools: ["export_dataset", "inspect_indexing"]
    },
    provenance: {
      sourceClass: "webmaster_console",
      method: "searchconsole.searchanalytics.query",
      confidence: 1.0,
      cacheTtl: "1 hour"
    },
    errors: [
      "ConnectionRequiredError: no Search Console site configured for domain. Add connection via /dashboard/connections."
    ]
  },

  inspect_indexing: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "A tracked website's primary_domain (e.g. example.com)."
      },
      {
        name: "url",
        type: "string",
        required: true,
        constraints: "Exact URL belonging to this verified property",
        description: "The exact URL to inspect."
      }
    ],
    dataSummary: "Google's authoritative URL inspection result: index verdict, Google-selected canonical vs user-declared canonical, robots.txt status, crawl timestamp, mobile usability, and rich result validation.",
    emittedFacts: [
      { type: "gsc.index_status", description: "Google index status: verdict (PASS/FAIL), coverage state, Google canonical, user canonical, last crawl time, and crawler user-agent.", fields: ["verdict", "coverage_state", "robots_txt_state", "indexing_state", "page_fetch_state", "last_crawl_time", "crawled_as", "google_canonical", "user_canonical"] },
      { type: "gsc.mobile_usability", description: "Mobile friendliness verdict and specific mobile layout issues.", fields: ["verdict", "issues"] },
      { type: "gsc.rich_results", description: "Rich snippets evaluation (Product, FAQ, Breadcrumbs, Article schema).", fields: ["verdict", "detected_items"] }
    ],
    entitiesEmitted: [
      { kind: "property", description: "Search Console property." },
      { kind: "page", description: "Inspected URL entity." }
    ],
    exampleCall: {
      domain: "example.com",
      url: "https://example.com/blog/mcp-guide"
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "gsc",
      data: {
        domain: "example.com",
        url: "https://example.com/blog/mcp-guide",
        inspectionResultLink: "https://search.google.com/search-console/inspect?resource_id=sc-domain%3Aexample.com&id=..."
      },
      facts: [
        {
          type: "gsc.index_status",
          subject: ["urn:page:https%3A%2F%2Fexample.com%2Fblog%2Fmcp-guide", "urn:property:ws_12345"],
          data: {
            verdict: "PASS",
            coverage_state: "Submitted and indexed",
            robots_txt_state: "ALLOWED",
            indexing_state: "INDEXING_ALLOWED",
            page_fetch_state: "SUCCESSFUL",
            last_crawl_time: "2026-09-22T14:15:30Z",
            crawled_as: "GOOGLEBOT_DESKTOP",
            google_canonical: "https://example.com/blog/mcp-guide",
            user_canonical: "https://example.com/blog/mcp-guide"
          },
          provenance: { source_class: "webmaster_console", method: "searchconsole.urlInspection.index.inspect", confidence: 1.0, observed_at: "2026-09-24T00:00:00Z", cache_hit: true }
        },
        {
          type: "gsc.mobile_usability",
          subject: ["urn:page:https%3A%2F%2Fexample.com%2Fblog%2Fmcp-guide"],
          data: { verdict: "PASS", issues: [] },
          provenance: { source_class: "webmaster_console", method: "searchconsole.urlInspection.index.inspect", confidence: 1.0, observed_at: "2026-09-24T00:00:00Z", cache_hit: true }
        }
      ],
      entities: [
        { id: "urn:property:ws_12345", kind: "property", label: "Example Prod" },
        { id: "urn:page:https%3A%2F%2Fexample.com%2Fblog%2Fmcp-guide", kind: "page", label: "https://example.com/blog/mcp-guide" }
      ],
      coverage: { returned: 2, total: 2, as_of: "2026-09-22T14:15:30Z", scope_note: "Direct inspection API call cached for 4 hours." },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "Why is https://example.com/blog/mcp-guide not showing up in search results?",
      agentReasoning: "The agent calls inspect_indexing to check whether Googlebot fetched the page, whether robots.txt blocked it, and if Google picked a different canonical URL.",
      followUpTools: ["get_search_performance", "list_sitemaps"]
    },
    provenance: {
      sourceClass: "webmaster_console",
      method: "searchconsole.urlInspection.index.inspect",
      confidence: 1.0,
      cacheTtl: "4 hours"
    },
    errors: [
      "ConnectionRequiredError: no Search Console site configured for domain. Add connection via /dashboard/connections."
    ]
  },

  list_sitemaps: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "A tracked website's primary_domain (e.g. example.com)."
      }
    ],
    dataSummary: "Lists all XML sitemaps submitted to Google Search Console for this website, their last submission/read timestamp, processing warnings/errors, and submitted URL counts.",
    emittedFacts: [
      { type: "gsc.sitemap_status", description: "Sitemap submission status, format, warnings, errors, and submitted contents.", fields: ["path", "last_submitted", "is_pending", "is_sitemaps_index", "warnings", "errors", "contents"] }
    ],
    entitiesEmitted: [
      { kind: "property", description: "Search Console property entity." }
    ],
    exampleCall: {
      domain: "example.com"
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "gsc",
      data: {
        domain: "example.com",
        sitemapCount: 1,
        contentsIndexedCountCaveat: "Google no longer populates each sitemap's contents[].indexed count (always 0); it's not a real signal. Use inspect_indexing for actual per-URL indexing status."
      },
      facts: [
        {
          type: "gsc.sitemap_status",
          subject: ["urn:property:ws_12345"],
          data: {
            path: "https://example.com/sitemap.xml",
            last_submitted: "2026-09-20T08:00:00Z",
            is_pending: false,
            is_sitemaps_index: false,
            warnings: 0,
            errors: 0,
            contents: [{ type: "web", submitted: 245 }]
          },
          provenance: { source_class: "webmaster_console", method: "searchconsole.sitemaps.list", confidence: 1.0, observed_at: "2026-09-24T00:00:00Z", cache_hit: true }
        }
      ],
      entities: [
        { id: "urn:property:ws_12345", kind: "property", label: "Example Prod" }
      ],
      coverage: { returned: 1, total: 1, as_of: "2026-09-20T08:00:00Z", scope_note: null },
      deltas: [],
      resources: [],
      next_actions: [
        { tool: "inspect_indexing", args: { domain: "example.com", url: "https://example.com/" }, use_when: "verify index status of individual URLs in sitemap" }
      ]
    },
    agentWorkflow: {
      triggerPrompt: "Are all sitemaps for example.com successfully read by Google without errors?",
      agentReasoning: "The agent verifies sitemap health, checks for Google parse errors, and confirms submitted URL counts match expected production routes.",
      followUpTools: ["inspect_indexing"]
    },
    provenance: {
      sourceClass: "webmaster_console",
      method: "searchconsole.sitemaps.list",
      confidence: 1.0,
      cacheTtl: "6 hours"
    },
    errors: [
      "ConnectionRequiredError: no Search Console site configured for domain."
    ]
  },

  get_website_analytics: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "A tracked website's primary_domain (e.g. example.com)."
      },
      {
        name: "startDate",
        type: "string",
        required: true,
        constraints: "ISO date format: YYYY-MM-DD",
        description: "Start date for GA4 report."
      },
      {
        name: "endDate",
        type: "string",
        required: true,
        constraints: "ISO date format: YYYY-MM-DD",
        description: "End date for GA4 report."
      },
      {
        name: "dimension",
        type: "enum",
        required: false,
        default: "date",
        constraints: "date | pagePath | sessionSource",
        description: "Break traffic metrics down by calendar date, landing page path, or session acquisition source."
      }
    ],
    dataSummary: "First-party Google Analytics 4 (GA4) traffic metrics: sessions, active users, and average engagement rate.",
    emittedFacts: [
      { type: "analytics.traffic_summary", description: "Aggregated period totals for sessions, active users, and engagement rate.", fields: ["sessions", "active_users", "avg_engagement_rate", "start_date", "end_date"] },
      { type: "analytics.traffic_by_dimension", description: "Row breakdown for selected dimension (date, page, or referral source).", fields: ["dimension", "dimension_value", "sessions", "active_users", "engagement_rate"] }
    ],
    entitiesEmitted: [
      { kind: "property", description: "Connected GA4 property entity." },
      { kind: "page", description: "Landing page entities when dimension is 'pagePath'." }
    ],
    exampleCall: {
      domain: "example.com",
      startDate: "2026-09-01",
      endDate: "2026-09-20",
      dimension: "pagePath"
    },
    exampleResponse: {
      schema_version: "ofe/1.0",
      domain: "analytics",
      data: {
        domain: "example.com",
        startDate: "2026-09-01",
        endDate: "2026-09-20",
        dimension: "pagePath",
        totals: { sessions: 48500, activeUsers: 34200, avgEngagementRate: 0.642 }
      },
      facts: [
        {
          type: "analytics.traffic_summary",
          subject: ["urn:property:ws_12345"],
          data: { sessions: 48500, active_users: 34200, avg_engagement_rate: 0.642, start_date: "2026-09-01", end_date: "2026-09-20" },
          provenance: { source_class: "analytics_property", method: "analyticsdata.properties.runReport", confidence: 1.0, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        },
        {
          type: "analytics.traffic_by_dimension",
          subject: ["urn:property:ws_12345", "urn:page:%2Fpricing"],
          data: { dimension: "pagePath", dimension_value: "/pricing", sessions: 12400, active_users: 9800, engagement_rate: 0.781 },
          provenance: { source_class: "analytics_property", method: "analyticsdata.properties.runReport", confidence: 1.0, observed_at: "2026-09-24T00:00:00Z", cache_hit: false }
        }
      ],
      entities: [
        { id: "urn:property:ws_12345", kind: "property", label: "Example Prod" },
        { id: "urn:page:%2Fpricing", kind: "page", label: "/pricing" }
      ],
      coverage: { returned: 2, total: 2, as_of: "2026-09-20", scope_note: null },
      deltas: [],
      resources: [],
      next_actions: []
    },
    agentWorkflow: {
      triggerPrompt: "How engaged are visitors on /pricing compared to the rest of the site in GA4?",
      agentReasoning: "The agent pulls first-party GA4 engagement metrics to correlate search impression traffic with actual conversion and on-page dwell times.",
      followUpTools: ["get_search_performance"]
    },
    provenance: {
      sourceClass: "analytics_property",
      method: "analyticsdata.properties.runReport",
      confidence: 1.0
    },
    errors: [
      "ConnectionRequiredError: no GA4 property configured for domain. Add connection via /dashboard/connections."
    ]
  }
};

export function getToolDocs(toolName: string): ToolDocumentation {
  const docs = TOOL_DOCS[toolName];
  if (docs) return docs;
  return {
    parameters: [],
    dataSummary: "Structured data envelope returned by this tool.",
    emittedFacts: [],
    entitiesEmitted: [],
    exampleCall: {},
    exampleResponse: { schema_version: "ofe/1.0", domain: "seo", data: {}, facts: [], entities: [], coverage: { returned: 0, total: 0, as_of: null, scope_note: null }, deltas: [], resources: [], next_actions: [] },
    agentWorkflow: {
      triggerPrompt: `Use ${toolName} for SEO analysis.`,
      agentReasoning: `Executes ${toolName} to retrieve structured SEO data.`,
      followUpTools: []
    },
    provenance: {
      sourceClass: "search_index",
      method: toolName,
      confidence: 0.75
    }
  };
}

