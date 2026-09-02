import { UpstreamError } from "../../lib/errors";
import type { Env } from "../../types/env";
import { recordCost } from "./cost-tracker";
import { dataForSeoAuthHeader } from "./dataforseo-auth";

const API_BASE = "https://api.dataforseo.com";

interface DfsTask<T> {
  id: string;
  status_code: number;
  status_message: string;
  cost: number;
  result: T[] | null;
}

interface DfsResponse<T> {
  status_code: number;
  status_message: string;
  cost: number;
  tasks?: DfsTask<T>[];
}

/**
 * Calls one DataForSEO `/live/` endpoint (synchronous — one POST returns
 * results directly, per DataForSEO's own docs) with a single task, logs its
 * real cost to D1, and returns that task's `result` array.
 *
 * NOTE: request/response field names here follow DataForSEO's documented
 * conventions, confirmed only via endpoint *paths* (from DataForSEO's own
 * `mcp-server-typescript` field-config, since docs.dataforseo.com itself
 * was unreachable while this was built) — not verified against a real
 * authenticated call, since this build has no DataForSEO API key. Confirm
 * request/response shape against the live API before trusting a new
 * endpoint wrapper built on this client.
 */
export async function dfsLivePost<TResult>(
  env: Env,
  toolName: string,
  path: string,
  task: Record<string, unknown>
): Promise<TResult[]> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: dataForSeoAuthHeader(env),
      "content-type": "application/json"
    },
    body: JSON.stringify([task])
  });

  if (!res.ok) {
    throw new UpstreamError("dataforseo", await res.text(), res.status);
  }

  const body = (await res.json()) as DfsResponse<TResult>;
  const task0 = body.tasks?.[0];
  if (!task0 || task0.status_code !== 20000) {
    throw new UpstreamError(
      "dataforseo",
      task0?.status_message ?? body.status_message ?? "no task result returned",
      task0?.status_code ?? body.status_code
    );
  }

  await recordCost(env, toolName, path, task0.cost);
  return task0.result ?? [];
}
