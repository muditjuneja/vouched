# Listing Vouched in MCP directories

What each directory needs, what's already in place, and what's left for a
person to do. The server itself is the same everywhere:
`https://vouchedhq.com/mcp`, Streamable HTTP, with standard MCP sign-in
(OAuth 2.1). See `docs/CLOUD.md` M22 for how sign-in works.

## Ready for every directory

- **Standard sign-in:** the `401` challenge, resource and authorization-server
  discovery documents, dynamic client registration, Client ID Metadata
  Documents and PKCE. No key or header to paste.
- **API keys** for clients that can only send a header.
- **Tool annotations** on all 19 tools (all read-only and non-destructive),
  plus titles and plain-language descriptions.
- **Privacy policy** (`/privacy`, with Google's Limited Use statement) and
  **terms** (`/terms`).
- **Support contact:** `hello@vouchedhq.com`.
- **Logo:** `assets/brand/` (see its README for which file goes where).

## Before submitting anywhere

1. **Public repository:** done, `https://github.com/muditjuneja/vouched`
   (`GITHUB_URL` in `src/marketing/github-url.ts`, `repository` in
   `server.json`).
2. **Production Clerk app** (not the development one), so reviewers don't see
   a "Development mode" banner at sign-in.
3. **A reviewer account:** directories test the sign-in themselves. Have one
   ready on a paid plan so they can try the market-data tools too.

## Official MCP Registry

The registry feeds VS Code, GitHub and other clients' server lists.

- **File:** `server.json` in the repo root (schema `2025-12-11`), named
  `com.vouchedhq/vouched`, remote `https://vouchedhq.com/mcp`, no headers.
- **Publish:** install `mcp-publisher`, then prove you own the domain with
  `mcp-publisher login dns` (it tells you which TXT record to add to
  vouchedhq.com in Cloudflare), then `mcp-publisher publish`.
- **Each release:** bump `version` in `server.json` and publish again.

## Anthropic's Claude connectors directory

- Anyone can already add Vouched today as a custom connector: Settings →
  Connectors → Add custom connector → `https://vouchedhq.com/mcp`.
- To be listed in the directory, submit through Anthropic's connector
  submission process (linked from Claude's help center). Reviewers check:
  standard sign-in, tool annotations, a privacy policy, a support contact,
  and a logo. All are in place; the reviewer account above is what they'll
  sign in with.

## Cursor

- **Works today:** users add `{"mcpServers": {"vouched-seo-mcp": {"url":
  "https://vouchedhq.com/mcp"}}}` to `~/.cursor/mcp.json` and sign in.
- **Directory:** cursor.directory follows the Agent Plugins standard
  (https://agent-plugins.org). `plugin.json` and `mcp.json` in the repo root
  make the repo a plugin: submit `https://github.com/muditjuneja/vouched` at
  cursor.directory/plugins/new with "Auto (GitHub)". Both files validate
  against the 1.0.0 schemas.
- **Each release:** keep `version` in `plugin.json` in step with `server.json`.
- Cursor also supports one-click install links; add one once its encoding is
  confirmed against Cursor's docs (the docs example was ambiguous when this
  was written).

## Smithery, Glama and other community directories

- **Smithery:** add the server by its URL (remote servers with sign-in are
  supported); it reads tool metadata from the server itself.
- **Glama:** indexes public GitHub repositories, so it needs the public repo
  first.
- For any other directory, the usual inputs are: name "Vouched", the URL,
  the 93-character description in `server.json`, the logo, the privacy
  policy, and the support email.

Directory submission forms change often: check each one's current
requirements when submitting rather than relying on this page alone.
