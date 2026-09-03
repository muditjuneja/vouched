import { Callout } from "../../design";
import { renderPage } from "../Layout";

/** The one-time reveal page for a newly created API key — never shown again after this. */
function ApiKeyCreatedPage({ plaintext }: { plaintext: string }) {
  return (
    <>
      <h1>Your new API key</h1>
      <Callout>
        <p>
          <strong>Copy this now</strong> — it won't be shown again.
        </p>
        <p class="key">{plaintext}</p>
      </Callout>
      <p>Add it to your MCP client, e.g.:</p>
      <pre class="key">
        {`claude mcp add --transport http mcp-seo-toolkit https://<your-worker>/mcp \\\n  --header "Authorization: Bearer ${plaintext}"`}
      </pre>
      <p>
        <a href="/dashboard">← Back to dashboard</a>
      </p>
    </>
  );
}

export function renderApiKeyCreated(plaintext: string): string {
  return renderPage({ title: "New API key", children: <ApiKeyCreatedPage plaintext={plaintext} /> });
}
