import { MCP_SERVER_NAME } from "../../lib/product";

/**
 * How to connect each MCP client. Apps that support MCP sign-in (OAuth)
 * just take the URL and ask the user to sign in; API keys remain for
 * scripts and clients that can only send a header. Only documented install
 * formats are used here: each client's own config file or CLI.
 */
export function ConnectGuide({ mcpUrl }: { mcpUrl: string }) {
  const claudeCode = `claude mcp add --transport http ${MCP_SERVER_NAME} ${mcpUrl}`;
  const cursorConfig = JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { url: mcpUrl } } }, null, 2);
  const vscode = `code --add-mcp '${JSON.stringify({ name: MCP_SERVER_NAME, type: "http", url: mcpUrl })}'`;

  return (
    <div class="connect-guide">
      <details open>
        <summary>Claude (web and desktop)</summary>
        <p class="muted">
          Settings → Connectors → Add custom connector. Paste the URL above, click Connect, sign in, and allow access. No key or header
          needed.
        </p>
      </details>
      <details>
        <summary>Claude Code</summary>
        <pre class="key">{claudeCode}</pre>
        <p class="muted">
          Then run <code>/mcp</code> in Claude Code, pick {MCP_SERVER_NAME}, and choose Authenticate to sign in.
        </p>
      </details>
      <details>
        <summary>Cursor</summary>
        <p class="muted">
          Add this to <code>~/.cursor/mcp.json</code>, then connect it from Cursor's MCP settings and sign in:
        </p>
        <pre class="key">{cursorConfig}</pre>
      </details>
      <details>
        <summary>VS Code</summary>
        <pre class="key">{vscode}</pre>
        <p class="muted">VS Code asks you to sign in the first time a tool runs.</p>
      </details>
      <details>
        <summary>Anything else, or a script</summary>
        <p class="muted">
          If a client can't sign in, create an <a href="/dashboard/api-keys?new=1">API key</a> and send it as{" "}
          <code>Authorization: Bearer &lt;key&gt;</code>.
        </p>
      </details>
    </div>
  );
}
