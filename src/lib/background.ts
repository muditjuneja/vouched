/**
 * Runs `work` after the response is sent (waitUntil) when the request has an
 * ExecutionContext, and simply awaits it when it doesn't (unit tests calling
 * a Hono app without one: Hono's getter throws there). `work` must not throw;
 * onboardUser and friends already swallow their own errors.
 */
export function runInBackground(c: { executionCtx: { waitUntil(promise: Promise<unknown>): void } }, work: Promise<unknown>): Promise<unknown> | undefined {
  try {
    c.executionCtx.waitUntil(work);
    return undefined;
  } catch {
    return work;
  }
}
