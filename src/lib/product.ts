/** Machine-facing product identifiers. Marketing chrome imports DISPLAY_NAME from here too. */

export const DISPLAY_NAME = "Vouched";
export const SITE_DOMAIN = "vouchedhq.com";
/** The hosted product's public origin. Pages use the request's own origin; this is for places with no request to read it from (emails, docs snippets). */
export const SITE_URL = `https://${SITE_DOMAIN}`;
export const MCP_SERVER_NAME = "vouched-seo-mcp";
export const KEY_PREFIX = "vsm_";
export const AUDIT_UA = `${MCP_SERVER_NAME}-audit/0.1`;
export const HEALTH_BODY = `${MCP_SERVER_NAME}: ok\n`;
export const D1_DATABASE_NAME = MCP_SERVER_NAME;
export const R2_BUCKET_NAME = `${MCP_SERVER_NAME}-datasets`;
