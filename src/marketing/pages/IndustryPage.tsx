import { Button } from "../../design";
import { Hero } from "../components/Hero";
import type { IndustryPage as IndustryPageContent } from "../content/industries";
import { GITHUB_URL } from "../github-url";
import { renderPage } from "../Layout";

function IndustryPage({ page, cloudMode }: { page: IndustryPageContent; cloudMode: boolean }) {
  return (
    <>
      <Hero eyebrow="Use case" heading={page.heading} lede={page.lede} />

      <section>
        {page.body.map((paragraph) => (
          <p>{paragraph}</p>
        ))}
      </section>

      <section>
        <h2>Relevant tools</h2>
        <ul>
          {page.toolCallouts.map((name) => (
            <li>
              <a href={`/tools/${name.replace(/_/g, "-")}`}>
                <code>{name}</code>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section class="cta-row">
        <Button href={GITHUB_URL} variant="primary">
          Self-host it
        </Button>
        {cloudMode ? <Button href="/dashboard">Try the cloud version</Button> : <Button href="/pricing">See pricing</Button>}
      </section>
    </>
  );
}

export function renderIndustryPage(page: IndustryPageContent, canonicalUrl: string, cloudMode: boolean): string {
  return renderPage({
    title: page.title,
    description: page.metaDescription,
    canonicalUrl,
    cloudMode,
    children: <IndustryPage page={page} cloudMode={cloudMode} />
  });
}
