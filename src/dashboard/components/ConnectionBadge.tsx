import { Badge } from "../../design";
import type { ConnectionState } from "../../auth/google-oauth";

/** Maps a Google-connection state onto the shared Badge's three status colors. */
export function ConnectionBadge({ state }: { state: ConnectionState | "not_configured" }) {
  if (state === "not_configured") return <Badge status="neutral" label="not configured" />;
  if (state === "connected") return <Badge status="good" label="connected" />;
  if (state === "reconnect_required") return <Badge status="warn" label="reconnect needed" />;
  return <Badge status="neutral" label="not connected" />;
}
