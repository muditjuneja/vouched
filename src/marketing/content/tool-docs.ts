export interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ToolDocumentation {
  parameters: ToolParameter[];
  exampleCall: Record<string, unknown>;
  notes?: string;
}

export const TOOL_DOCS: Record<string, ToolDocumentation> = {
  describe_capabilities: {
    parameters: [],
    exampleCall: {},
    notes: "Returns enabled domains, available tool definitions, emitted fact types, and recognized provenance source classes."
  },
  export_dataset: {
    parameters: [
      {
        name: "uri",
        type: "string",
        required: true,
        description: "The mcpseo:// dataset URI returned by a previous tool call or export link (e.g. mcpseo://gsc/performance/example.com)."
      }
    ],
    exampleCall: {
      uri: "mcpseo://gsc/performance/example.com"
    },
    notes: "Fetches complete, unpaginated raw dataset tables persisted in R2/D1 storage."
  },
  list_websites: {
    parameters: [],
    exampleCall: {},
    notes: "Lists all tracked client websites in your workspace, along with their connected Google Search Console site URLs and GA4 property IDs."
  },
  inspect_domain: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "Target domain name to inspect (e.g. stripe.com)."
      }
    ],
    exampleCall: {
      domain: "stripe.com"
    },
    notes: "Emits high-level domain health, top organic keywords, estimated traffic, and top competitor domains."
  },
  discover_competitors: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: false,
        description: "Target domain to find organic search competitors for."
      },
      {
        name: "seedKeywords",
        type: "string[]",
        required: false,
        description: "Optional list of seed search terms to identify domain overlap."
      },
      {
        name: "limit",
        type: "number",
        required: false,
        description: "Maximum number of competitor domains to return (default 10)."
      }
    ],
    exampleCall: {
      domain: "stripe.com",
      limit: 10
    }
  },
  research_keywords: {
    parameters: [
      {
        name: "seedKeywords",
        type: "string[]",
        required: true,
        description: "One or more seed keywords to expand into demand suggestions (1 to 20 terms)."
      },
      {
        name: "limit",
        type: "number",
        required: false,
        description: "Maximum number of keyword ideas to return (default 50, max 200)."
      }
    ],
    exampleCall: {
      seedKeywords: ["open source seo", "developer marketing mcp"],
      limit: 25
    },
    notes: "Emits seo.keyword_opportunity facts with monthly search volume, CPC, competition score, and difficulty."
  },
  compare_keyword_coverage: {
    parameters: [
      {
        name: "domains",
        type: "string[]",
        required: true,
        description: "2 to 5 domain names to cross-compare for organic keyword ranking overlap."
      },
      {
        name: "limit",
        type: "number",
        required: false,
        description: "Maximum overlapping and distinct keywords to report (default 50)."
      }
    ],
    exampleCall: {
      domains: ["postman.com", "insomnia.rest"],
      limit: 30
    }
  },
  inspect_search_visibility: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "Domain name to measure historical search visibility trends and ranking trajectory for."
      }
    ],
    exampleCall: {
      domain: "linear.app"
    }
  },
  inspect_keyword: {
    parameters: [
      {
        name: "keyword",
        type: "string",
        required: true,
        description: "The exact search query term to analyze."
      }
    ],
    exampleCall: {
      keyword: "open source mcp servers"
    },
    notes: "Emits detailed volume history, intent categorization (informational, commercial), and SERP feature breakdown."
  },
  inspect_page: {
    parameters: [
      {
        name: "url",
        type: "string",
        required: true,
        description: "The full web page URL (including protocol) to inspect on-page metrics and ranking terms for."
      }
    ],
    exampleCall: {
      url: "https://stripe.com/pricing"
    }
  },
  inspect_serp: {
    parameters: [
      {
        name: "keyword",
        type: "string",
        required: true,
        description: "The search query to snapshot live Google search results for."
      },
      {
        name: "locationCode",
        type: "number",
        required: false,
        description: "DataForSEO country location code (default 2840 for United States)."
      }
    ],
    exampleCall: {
      keyword: "best developer tools 2026",
      locationCode: 2840
    },
    notes: "Pulls organic ranks, featured snippets, People Also Ask boxes, and AI Overviews with live SERP provenance (0.85 confidence)."
  },
  inspect_backlinks: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "Domain name to inspect the inbound link profile and referring domains for."
      },
      {
        name: "limit",
        type: "number",
        required: false,
        description: "Maximum backlink entries to return (default 25)."
      }
    ],
    exampleCall: {
      domain: "github.com",
      limit: 25
    }
  },
  compare_backlink_gap: {
    parameters: [
      {
        name: "targetDomain",
        type: "string",
        required: true,
        description: "Your primary domain name."
      },
      {
        name: "competitorDomains",
        type: "string[]",
        required: true,
        description: "1 to 3 competitor domains to evaluate for backlink gap opportunities."
      }
    ],
    exampleCall: {
      targetDomain: "mysite.com",
      competitorDomains: ["rivalsite.com", "altrival.io"]
    }
  },
  discover_ai_citations: {
    parameters: [
      {
        name: "topic",
        type: "string",
        required: true,
        description: "Category query or topic phrase to inspect generative AI citations and sources for."
      }
    ],
    exampleCall: {
      topic: "fast headless cms for developers"
    }
  },
  inspect_ai_visibility: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "Domain name to measure brand visibility and recommendation prominence in AI answer engines."
      }
    ],
    exampleCall: {
      domain: "supabase.com"
    }
  },
  get_search_performance: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "A tracked website's primary domain (must have connected GSC property)."
      },
      {
        name: "startDate",
        type: "string",
        required: true,
        description: "Start date formatted as YYYY-MM-DD."
      },
      {
        name: "endDate",
        type: "string",
        required: true,
        description: "End date formatted as YYYY-MM-DD."
      },
      {
        name: "dimensions",
        type: "string[]",
        required: false,
        description: "Dimensions to group by (e.g. ['query', 'page', 'country', 'device', 'date']). Default is ['query']."
      },
      {
        name: "rowLimit",
        type: "number",
        required: false,
        description: "Maximum rows to return (default 25, max 1000)."
      }
    ],
    exampleCall: {
      domain: "example.com",
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      dimensions: ["query", "page"],
      rowLimit: 25
    },
    notes: "Pulls unmodeled ground-truth Search Console clicks, impressions, CTR, and average position (confidence 1.0)."
  },
  inspect_indexing: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "A tracked website's primary domain."
      },
      {
        name: "url",
        type: "string",
        required: true,
        description: "The exact URL belonging to this website to inspect with the Google URL Inspection API."
      }
    ],
    exampleCall: {
      domain: "example.com",
      url: "https://example.com/blog/scaling-mcp-servers"
    },
    notes: "Returns real-time Google indexing verdict (PASS/FAIL), coverage state, Google-selected canonical vs user canonical, and mobile usability."
  },
  list_sitemaps: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "A tracked website's primary domain."
      }
    ],
    exampleCall: {
      domain: "example.com"
    },
    notes: "Returns all sitemaps submitted to Google Search Console, last downloaded timestamp, error counts, and URL counts."
  },
  get_website_analytics: {
    parameters: [
      {
        name: "domain",
        type: "string",
        required: true,
        description: "A tracked website's primary domain (must have connected GA4 property)."
      },
      {
        name: "days",
        type: "number",
        required: false,
        description: "Trailing day window to report metrics for (default 30 days)."
      }
    ],
    exampleCall: {
      domain: "example.com",
      days: 30
    },
    notes: "Returns first-party GA4 active users, sessions, pageviews, bounce rate, and top landing pages with engagement rates."
  },
  audit_site: {
    parameters: [
      {
        name: "url",
        type: "string",
        required: true,
        description: "Root URL to audit."
      }
    ],
    exampleCall: {
      url: "https://example.com"
    },
    notes: "Note: Deliberately held back (implemented: false) until queue-based BFS crawling is reworked for Cloudflare Workers."
  }
};

export function getToolDocs(toolName: string): ToolDocumentation {
  return (
    TOOL_DOCS[toolName] ?? {
      parameters: [],
      exampleCall: {},
      notes: "Refer to the MCP manifest for schema details."
    }
  );
}
