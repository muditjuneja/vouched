import { Callout } from "../../design";
import { MCP_SERVER_NAME } from "../../lib/product";
import { renderPage } from "../Layout";
import type { DashboardUser } from "../types";

/** The one-time reveal page for a newly created API key, never shown again after this. */
function ApiKeyCreatedPage({ plaintext, workerOrigin }: { plaintext: string; workerOrigin?: string }) {
  const mcpUrl = workerOrigin ? `${workerOrigin}/mcp` : `https://<your-worker>/mcp`;

  const claudeCliCommand = `claude mcp add --transport http ${MCP_SERVER_NAME} ${mcpUrl} \\\n  --header "Authorization: Bearer ${plaintext}"`;

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${plaintext}`
          }
        }
      }
    },
    null,
    2
  );

  const desktopConfig = JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          command: "npx",
          args: ["-y", "mcp-remote", mcpUrl, "--header", `Authorization: Bearer ${plaintext}`]
        }
      }
    },
    null,
    2
  );

  return (
    <div style="max-width: 44rem;">
      <h1>Your new API key</h1>
      <Callout>
        <p>
          <strong>Copy this now</strong>, it won't be shown again.
        </p>
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
          <span class="key" style="font-weight: 600; font-size: 0.95rem; flex: 1;">
            {plaintext}
          </span>
          <button type="button" class="btn btn-primary btn-copy" data-copy={plaintext}>
            Copy key
          </button>
        </div>
      </Callout>

      <h2 style="margin-top: 1.5rem;">Connect to your MCP Client</h2>

      <section class="panel">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">1. Claude Code / CLI</h3>
          <button type="button" class="btn btn-sm btn-copy" data-copy={claudeCliCommand}>
            Copy command
          </button>
        </div>
        <pre class="key" style="margin-top: 0.5rem;">
          {claudeCliCommand}
        </pre>
      </section>

      <section class="panel">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">2. Cursor (.cursor/mcp.json)</h3>
          <button type="button" class="btn btn-sm btn-copy" data-copy={cursorConfig}>
            Copy JSON
          </button>
        </div>
        <p class="muted" style="font-size: 0.82rem; margin: 0.25rem 0 0.5rem;">
          Add to your workspace or global <code>.cursor/mcp.json</code>:
        </p>
        <pre class="key">{cursorConfig}</pre>
      </section>

      <section class="panel">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">3. Claude Desktop (claude_desktop_config.json)</h3>
          <button type="button" class="btn btn-sm btn-copy" data-copy={desktopConfig}>
            Copy JSON
          </button>
        </div>
        <p class="muted" style="font-size: 0.82rem; margin: 0.25rem 0 0.5rem;">
          Paste inside your <code>claude_desktop_config.json</code> under <code>mcpServers</code>:
        </p>
        <pre class="key">{desktopConfig}</pre>
      </section>

      <p style="margin-top: 1.5rem;">
        <a href="/dashboard/api-keys" class="btn btn-primary">
          Done, back to API keys
        </a>
      </p>
    </div>
  );
}

export function renderApiKeyCreated(plaintext: string, workerOrigin?: string, user?: DashboardUser): string {
  return renderPage({
    title: "New API key",
    activePath: "/dashboard/api-keys",
    user,
    children: <ApiKeyCreatedPage plaintext={plaintext} workerOrigin={workerOrigin} />
  });
}

