# Listing Vouched in MCP directories

What each directory needs, what's already in the repo, and what's left for a
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
- **No upsell in tool results.** Errors for missing market data, used-up
  quota and the free daily cap say what's unavailable without asking the
  user to upgrade or buy (ChatGPT's directory requires this; see
  `src/lib/errors.ts`). Upgrade prompts stay in the dashboard.
- **Privacy policy** (`/privacy`, with Google's Limited Use statement) and
  **terms** (`/terms`).
- **Support contact:** `hello@vouchedhq.com`.
- **Logo:** `assets/brand/` (see its README for which file goes where).
- **Skill:** `skills/seo-analysis/SKILL.md` tells the agent which tools to
  chain for common questions. Every plugin format below ships it.

## Before submitting anywhere

1. **Production Clerk app** (not the development one), so reviewers don't see
   a "Development mode" banner at sign-in.
2. **A reviewer account** on a paid plan with a site connected, so reviewers
   can try every tool. No 2FA on it: ChatGPT's review rejects logins it
   can't complete.

## Manifests in this repo

| File | Used by |
|---|---|
| `server.json` | Official MCP Registry |
| `plugin.json`, `mcp.json` | Agent Plugins standard: cursor.directory, other Agent Plugins directories |
| `.cursor-plugin/plugin.json` | Cursor Marketplace (reads `mcp.json` and `skills/`) |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | Claude Code plugins |
| `gemini-extension.json` | Gemini CLI extensions and its gallery |
| `glama.json` | Claims the Glama listing for the `muditjuneja` GitHub account |

## Releasing a new version

1. Bump `version` in `server.json`, `plugin.json`, `gemini-extension.json`,
   `.claude-plugin/plugin.json` and `.cursor-plugin/plugin.json` (all the
   same).
2. Merge to `main`, then tag it: `git tag v0.2.0 && git push origin v0.2.0`.
3. `.github/workflows/release.yml` checks every manifest matches the tag and
   publishes `server.json` to the MCP Registry. The Gemini gallery picks the
   tag up on its daily crawl; Claude Code and Cursor read `main`.

## Official MCP Registry

Feeds the server lists in VS Code/GitHub Copilot and other clients.

- **Namespace:** `com.vouchedhq/vouched`, proven by a DNS TXT record on
  `vouchedhq.com`.
- **One-time setup:**
  1. Add the TXT record on the apex `vouchedhq.com` in Cloudflare:
     `v=MCPv1; k=ed25519; p=<public key>`.
  2. Save the matching hex private key as the repository secret
     `MCP_REGISTRY_PRIVATE_KEY` (Settings → Secrets and variables → Actions).
     Keep a copy in a password manager; it can't be recovered from the
     public key.
- **Publish:** push a version tag (see above). A tag for a version that's
  already published only checks the login. By hand instead:
  `mcp-publisher login dns --domain vouchedhq.com --private-key <hex>`, then
  `mcp-publisher publish`.
- **Rotating the key:** generate a new ed25519 pair, replace the TXT record
  and the secret.

## Anthropic's Claude connectors directory

- Anyone can add Vouched today as a custom connector: Settings → Connectors →
  Add custom connector → `https://vouchedhq.com/mcp`.
- Submitted; waiting on review.

## Claude Code plugins

- **Works today:** `claude plugin marketplace add muditjuneja/vouched`, then
  `claude plugin install vouched@vouched`. This installs the MCP server and
  the skill. `claude plugin validate .` checks the manifests.
- **Anthropic's plugin directory:** submit the repo through the form linked
  from https://code.claude.com/docs/en/plugins/publish. Once listed,
  community sites such as claudemarketplaces.com pick it up.

## ChatGPT app directory

- **Works today:** with Developer Mode on in ChatGPT's settings, add
  `https://vouchedhq.com/mcp` as a custom app and sign in.
- **Submit:** OpenAI Platform dashboard → Apps. Needs a verified individual
  or organization account. Tools-only apps are allowed, so no screenshots.
- **Have ready:** name, subtitle, description, category (Business or
  Productivity), `mark-512.png`, privacy and terms URLs, support email, the
  reviewer login, a short justification for each tool (all read-only), and
  test prompts such as "Why did clicks to example.com drop last month?".
- **Domain verification:** OpenAI gives a token to serve from
  `vouchedhq.com`; add the route when the dashboard shows it.
- Review takes about 3–7 business days.

## Cursor

- **Works today:** users add `{"mcpServers": {"vouched": {"url":
  "https://vouchedhq.com/mcp"}}}` to `~/.cursor/mcp.json` and sign in.
- **cursor.directory:** submitted from the repo with "Auto (GitHub)"; it
  reads `plugin.json`, `mcp.json` and `skills/`. Rescan after changes.
- **Cursor Marketplace** (in-app, one-click install): submit the repo at
  https://cursor.com/marketplace/publish. It reads `.cursor-plugin/plugin.json`
  and is reviewed by hand, including every update.

## Gemini CLI

- **Works today:** `gemini extensions install https://github.com/muditjuneja/vouched`.
- **Gallery (geminicli.com/extensions):** add the `gemini-cli-extension`
  topic in the repo's About section and push a version tag. It's crawled
  daily; indexing has been slow for some repos, so check after a few days.

## Community directories

- **Glama:** indexes public repos; `glama.json` lets the `muditjuneja`
  account claim the listing at glama.ai.
- **Smithery:** smithery.ai/new → add by URL (`https://vouchedhq.com/mcp`);
  it reads tool metadata from the server.
- **PulseMCP, mcp.so, mcp.directory:** submission forms. Use name
  "Vouched", the URL, the description from `server.json`, `mark-512.png`,
  the privacy policy and the support email.

Directory submission forms change often: check each one's current
requirements when submitting rather than relying on this page alone.
