import type { PropsWithChildren } from "hono/jsx";

/** A boxed note, used for the one-time API-key reveal, warnings, "not configured" messages. */
export function Callout({ children }: PropsWithChildren) {
  return <div class="callout">{children}</div>;
}
