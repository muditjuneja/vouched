export { DISPLAY_NAME, MCP_SERVER_NAME, SITE_DOMAIN } from "../lib/product";
export { GITHUB_URL } from "./github-url";

export const TAGLINE = "SEO facts your agent can vouch for.";

export function cloudCtaHref(cloudMode: boolean): string {
  return cloudMode ? "/dashboard" : "/pricing#cloud";
}
