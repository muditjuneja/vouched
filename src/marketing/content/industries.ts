/**
 * A handful of use-case pages (`/for/<slug>`). Small and hand-written on
 * purpose: the instinct to templatize these into a large matrix (one page
 * per industry x tool, say) is exactly the thin/spammy pSEO pattern the
 * task asked to avoid. The 18 per-tool pages already cover that ground
 * legitimately (one real capability each); these two cover genuinely
 * different buying contexts instead.
 */
export interface IndustryPage {
  slug: string;
  title: string;
  metaDescription: string;
  heading: string;
  lede: string;
  body: string[];
  toolCallouts: string[];
}

export const INDUSTRY_PAGES: IndustryPage[] = [
  {
    slug: "agencies",
    title: "Vouched for agencies: self-hosted SEO data, no per-seat markup",
    metaDescription:
      "SEO/marketing agencies running multiple client sites through Claude or another MCP client: self-host Vouched and pay DataForSEO directly, no per-client markup.",
    heading: "For agencies",
    lede: "Run every client's keyword research, backlink audits, and technical audits through the same MCP tools your team already uses inside Claude, without a per-seat SaaS bill stacked on top of the underlying data cost.",
    body: [
      "An agency juggling several client domains usually ends up paying for SEO tool " +
        "seats per analyst, on top of the vendor's own data costs. Self-hosting " +
        "Vouched removes that markup layer: you supply your own DataForSEO " +
        "API key, and every keyword-research or backlink-gap call is billed at " +
        "DataForSEO's own pay-as-you-go rate, with nothing added on top.",
      "Because every tool call returns the same OFE envelope, typed facts with " +
        "provenance (source, method, freshness, confidence), a report generated for " +
        "one client and one generated for another are structurally comparable, which " +
        "matters when you're producing audits across a portfolio of sites rather than " +
        "one.",
      "The free tier (`core`, `audit`, `gsc`, `analytics`) already covers a full " +
        "technical audit plus each client's own Search Console/Analytics data with zero " +
        "paid vendors: useful for a first pass before deciding which sites are worth " +
        "spending DataForSEO budget on for keyword/backlink research."
    ],
    toolCallouts: ["audit_site", "compare_keyword_coverage", "compare_backlink_gap", "list_websites"]
  },
  {
    slug: "indie-hackers",
    title: "Vouched for indie hackers: free self-host, pay only for what you use",
    metaDescription:
      "Solo builders and indie hackers: run SEO research and site audits from Claude with Vouched's free self-host tier, no subscription required.",
    heading: "For indie hackers",
    lede: "You don't need an SEO-suite subscription to find keywords, check your backlink profile, or catch a broken title tag. The free tier does all of that with zero paid vendors, and DataForSEO's pay-as-you-go pricing means the paid tools cost only what you actually query.",
    body: [
      "A solo builder shipping a new product doesn't have agency-scale SEO budget, and " +
        "most SEO suites price for teams, not one person checking rankings occasionally. " +
        "`audit_site`, `get_search_performance`, and `get_website_analytics` are free, " +
        "backed by your own Search Console/Analytics connection and a self-crawl, no " +
        "DataForSEO account needed at all.",
      "When you do want keyword or competitor research, self-hosting means you bring " +
        "your own DataForSEO key and pay DataForSEO's rate directly. There's no monthly " +
        "SaaS minimum sitting between you and the data, and no markup on top of what " +
        "DataForSEO itself charges.",
      "Because it's an MCP server, the whole thing is just another tool available inside " +
        "Claude: ask about a competitor's keyword gap or your own site's technical " +
        "health in the same conversation where you're already working on the product."
    ],
    toolCallouts: ["research_keywords", "audit_site", "get_search_performance", "inspect_domain"]
  }
];

export function findIndustryPage(slug: string): IndustryPage | undefined {
  return INDUSTRY_PAGES.find((page) => page.slug === slug);
}
