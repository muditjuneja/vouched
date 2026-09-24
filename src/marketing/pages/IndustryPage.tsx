import { Button } from "../../design";
import { cloudCta } from "../brand";
import { Hero } from "../components/Hero";
import type { IndustryPage as IndustryPageContent } from "../content/industries";
import { GITHUB_URL } from "../github-url";
import { renderPage } from "../Layout";

function IndustryPage({ page, cloudMode, signedIn }: { page: IndustryPageContent; cloudMode: boolean; signedIn: boolean }) {
  const cta = cloudCta(cloudMode, signedIn);
  return (
    <>
      <Hero eyebrow="Use case" heading={page.heading} lede={page.lede} />

      <section>
        {page.body.map((paragraph) => (
          <p>{paragraph}</p>
        ))}
      </section>

      <section>
        <p class="chapter">Tools</p>
        <h2>Relevant tools</h2>
        <ul class="tool-callouts">
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
        <Button href={cta.href}>{cta.label}</Button>
      </section>
    </>
  );
}

export function renderIndustryPage(page: IndustryPageContent, canonicalUrl: string, cloudMode: boolean, signedIn = false): string {
  return renderPage({
    title: page.title,
    description: page.metaDescription,
    canonicalUrl,
    cloudMode,
    signedIn,
    children: <IndustryPage page={page} cloudMode={cloudMode} signedIn={signedIn} />
  });
}
