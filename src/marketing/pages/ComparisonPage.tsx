import { Callout, Table } from "../../design";
import { Hero } from "../components/Hero";
import type { ComparisonPage as ComparisonPageContent } from "../content/comparisons";
import { GITHUB_URL } from "../github-url";
import { renderPage } from "../Layout";
import { Button } from "../../design";

function ComparisonPage({ page, cloudMode }: { page: ComparisonPageContent; cloudMode: boolean }) {
  return (
    <>
      <Hero eyebrow="Comparison" heading={page.title.replace(/ vs\.? .*/i, "")} lede={page.intro} />

      <section>
        <h2>Structural comparison</h2>
        <Table class="compare" headers={["", "mcp-seo-toolkit", page.competitor]}>
          {page.rows.map((row) => (
            <tr>
              <td>{row.label}</td>
              <td>{row.us}</td>
              <td>{row.them}</td>
            </tr>
          ))}
        </Table>
        <Callout>{page.caveat}</Callout>
      </section>

      <section class="cta-row">
        <Button href={GITHUB_URL} variant="primary">
          Self-host mcp-seo-toolkit
        </Button>
        {cloudMode ? <Button href="/dashboard">Try the cloud version</Button> : <Button href="/pricing">See pricing</Button>}
      </section>
    </>
  );
}

export function renderComparison(page: ComparisonPageContent, canonicalUrl: string, cloudMode: boolean): string {
  return renderPage({
    title: page.title,
    description: page.metaDescription,
    canonicalUrl,
    cloudMode,
    children: <ComparisonPage page={page} cloudMode={cloudMode} />
  });
}
