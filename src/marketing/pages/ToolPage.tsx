import { Button } from "../../design";
import { DOMAIN_LABELS, TOOL_PAGES, type ToolPageContent } from "../content/tool-pages";
import { Hero } from "../components/Hero";
import { GITHUB_URL } from "../github-url";
import { renderPage } from "../Layout";

function billingNote(billing: ToolPageContent["entry"]["billing"]): string {
  return billing === "free"
    ? "Free: part of the zero-paid-vendor free tier. No DataForSEO account or API key needed."
    : "Part of the DataForSEO-backed tier. Self-host with your own DataForSEO API key (billed by DataForSEO directly, zero markup), or use it bundled on a hosted cloud plan.";
}

function ToolPage({ page, cloudMode }: { page: ToolPageContent; cloudMode: boolean }) {
  const { entry, title } = page;
  const domainLabel = DOMAIN_LABELS[entry.domain] ?? entry.domain;

  return (
    <>
      <Hero
        eyebrow={
          <>
            {domainLabel} tool · <code>{entry.name}</code>
          </>
        }
        heading={title}
        lede={entry.summary}
      />

      <section>
        <h2>What it returns</h2>
        {entry.fact_types.length > 0 ? (
          <ul>
            {entry.fact_types.map((fact) => (
              <li>
                <code>{fact}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted">This tool doesn't emit typed facts itself; it's a capability/listing tool, not a data pull.</p>
        )}
        {entry.source_classes.length > 0 ? (
          <p>
            Backed by: <code>{entry.source_classes.join(", ")}</code>. Every fact carries its own provenance (source class, method,
            freshness, and a confidence score), so you can judge how much to trust it instead of taking an unlabeled number on faith.
          </p>
        ) : null}
      </section>

      <section>
        <h2>Pricing</h2>
        <p>{billingNote(entry.billing)}</p>
        {entry.requires_connection ? (
          <p>
            Requires connecting your own Google {entry.requires_connection === "webmaster_console" ? "Search Console" : "Analytics"}{" "}
            property first; this is your own first-party data, not a modeled estimate.
          </p>
        ) : null}
      </section>

      <section class="cta-row">
        <Button href={GITHUB_URL} variant="primary">
          Self-host it (MIT license)
        </Button>
        {cloudMode ? <Button href="/dashboard">Try it on the cloud plan</Button> : <Button href="/pricing">See pricing</Button>}
      </section>

      <section>
        <p class="muted">
          <a href="/tools">← All {TOOL_PAGES.length} tools</a>
        </p>
      </section>
    </>
  );
}

export function renderToolPage(page: ToolPageContent, canonicalUrl: string, cloudMode: boolean): string {
  return renderPage({
    title: `${page.title} · mcp-seo-toolkit`,
    description: page.metaDescription,
    canonicalUrl,
    cloudMode,
    children: <ToolPage page={page} cloudMode={cloudMode} />
  });
}
