import { ConfigError } from "../../lib/errors";
import type { Env } from "../../types/env";

/** HTTP Basic auth header from DATAFORSEO_LOGIN/PASSWORD. */
export function dataForSeoAuthHeader(env: Env): string {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
    throw new ConfigError(
      "DataForSEO is not configured — set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to use this tool"
    );
  }
  return `Basic ${btoa(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`)}`;
}
