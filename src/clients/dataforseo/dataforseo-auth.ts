import { ConfigError } from "../../lib/errors";
import type { Env } from "../../types/env";

function basicAuthHeader(login: string, password: string): string {
  return `Basic ${btoa(`${login}:${password}`)}`;
}

/** Self-host's BYOK credentials — HTTP Basic auth from DATAFORSEO_LOGIN/PASSWORD. */
export function dataForSeoAuthHeader(env: Env): string {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
    throw new ConfigError(
      "DataForSEO is not configured — set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to use this tool"
    );
  }
  return basicAuthHeader(env.DATAFORSEO_LOGIN, env.DATAFORSEO_PASSWORD);
}

/** The cloud tier's own account, used for bundled-access calls — never the tenant's own key. */
export function bundledDataForSeoAuthHeader(env: Env): string {
  if (!env.CLOUD_DATAFORSEO_LOGIN || !env.CLOUD_DATAFORSEO_PASSWORD) {
    throw new ConfigError(
      "Bundled DataForSEO access is not configured on this deployment (CLOUD_DATAFORSEO_LOGIN/PASSWORD)"
    );
  }
  return basicAuthHeader(env.CLOUD_DATAFORSEO_LOGIN, env.CLOUD_DATAFORSEO_PASSWORD);
}
