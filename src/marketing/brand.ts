export { DISPLAY_NAME, MCP_SERVER_NAME, SITE_DOMAIN } from "../lib/product";
export { GITHUB_URL } from "./github-url";

export const TAGLINE = "SEO facts your agent can vouch for.";

export function cloudCtaHref(cloudMode: boolean): string {
  return cloudMode ? "/dashboard" : "/pricing#cloud";
}

/** The "try Cloud" button: a signed-in visitor is sent straight to their dashboard instead of being asked to start. */
export function cloudCta(cloudMode: boolean, signedIn: boolean): { href: string; label: string } {
  return { href: cloudCtaHref(cloudMode), label: cloudMode && signedIn ? "Open dashboard" : "Start on Cloud" };
}
