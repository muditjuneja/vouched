# vouched-seo-mcp (Vouched)

An open-source (MIT) MCP server for SEO/marketing data on Cloudflare
Workers. Spoken name: **Vouched**. Site: vouchedhq.com. Machine id:
`vouched-seo-mcp`. Dataset URIs stay `mcpseo://` (OFE-compatible).

SEO facts your agent can cite, same 18-tool manifest whether you run
**Vouched Cloud** or **self-hosted Community**.

- **Community / self-host**: your Worker, optional BYOK DataForSEO, zero
  markup. See [`docs/SELF_HOST.md`](docs/SELF_HOST.md).
- **Cloud**: we run it; bundled DataForSEO; dashboard, keys, quotas.
  See [`docs/CLOUD.md`](docs/CLOUD.md).

Vendor split (free Google/self-crawl tools vs DataForSEO-backed tools) is
a capability footnote, not the Cloud vs Community story.

**17 of 18 tools in OpenRush's manifest are implemented and exposed**,
see [`docs/TOOLS.md`](docs/TOOLS.md) for the live per-tool
`implemented`/enabled breakdown `describe_capabilities` itself reports.
`audit_site` is built but deliberately held back until its crawl is
reworked to fit this Workers architecture properly.

## Docs

- [`docs/SELF_HOST.md`](docs/SELF_HOST.md), self-host setup.
- [`docs/CLOUD.md`](docs/CLOUD.md), cloud architecture.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), overall system design.
- [`docs/TOOLS.md`](docs/TOOLS.md), generated tool-by-tool reference.
- [`docs/OFE_ENVELOPE.md`](docs/OFE_ENVELOPE.md), the shared response
  shape every tool returns.

## Status

M0-M19 are complete and pushed: the full 18-tool-manifest self-hosted
server (17 currently exposed, see above), plus
the cloud surface (Hono, multi-tenant D1, Clerk, Dodo billing, bundled
DataForSEO quotas with a real margin, a prepaid overage wallet for usage
beyond a plan's bundled quota, dashboard, marketing/pSEO). External
integrations built without a live account in this sandbox have unverified
assumptions called out in comments and docs; confirm against the real
service before trusting those claims.

Also see the **[known sandbox limitation](docs/SELF_HOST.md#known-limitation-of-some-sandboxed-dev-environments)**
affecting `wrangler dev`/`deploy` and `@cloudflare/vitest-pool-workers` in
network-restricted environments.

## Open decisions (not settled by this build)

- **Workers plan**: the crawler (`audit_site`) and multi-call tools like
  `inspect_domain` need the Paid plan's higher CPU/subrequest limits; the
  Free plan's 10ms CPU / 50-subrequest caps won't run them.
- **MCP endpoint auth (self-host)**: currently a shared bearer token
  (simplest for a personal server). Swap for
  `@cloudflare/workers-oauth-provider` if this should be installable as a
  discoverable connector instead. (Cloud mode already uses per-tenant API
  keys, see `docs/CLOUD.md`.)
