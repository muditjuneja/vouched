import { Callout, Table } from "../../design";
import { DISPLAY_NAME, cloudCta } from "../brand";
import { Hero } from "../components/Hero";
import type { ComparisonPage as ComparisonPageContent } from "../content/comparisons";
import { GITHUB_URL } from "../github-url";
import { renderPage } from "../Layout";
import { Button } from "../../design";

function ComparisonPage({ page, cloudMode, signedIn }: { page: ComparisonPageContent; cloudMode: boolean; signedIn: boolean }) {
  const cta = cloudCta(cloudMode, signedIn);
  return (
    <>
      <Hero eyebrow="Comparison" heading={page.title} lede={page.intro} />

      <section>
        <h2>Structural comparison</h2>
        <Table class="compare" headers={["", DISPLAY_NAME, page.competitor]}>
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
          Self-host {DISPLAY_NAME}
        </Button>
        <Button href={cta.href}>{cta.label}</Button>
      </section>
    </>
  );
}

export function renderComparison(page: ComparisonPageContent, canonicalUrl: string, cloudMode: boolean, signedIn = false): string {
  return renderPage({
    title: page.title,
    description: page.metaDescription,
    canonicalUrl,
    cloudMode,
    signedIn,
    children: <ComparisonPage page={page} cloudMode={cloudMode} signedIn={signedIn} />
  });
}
