import { Button, Table } from "../../design";
import type { ConnectedApp } from "../types";

/** Apps signed in over MCP OAuth. Disconnecting revokes the grant and every token it issued, immediately. */
export function ConnectedAppsSection({ apps }: { apps: ConnectedApp[] }) {
  return (
    <section class="panel">
      <h2>Connected apps</h2>
      <p class="muted">
        Apps you've connected by signing in, such as Claude or Cursor. Each one acts in your workspace until you disconnect it.
      </p>
      {apps.length === 0 ? (
        <p class="muted">None yet. Add {"https://vouchedhq.com/mcp"} as a connector in your AI app and sign in.</p>
      ) : (
        <Table headers={["App", "Access sent to", "Connected", ""]}>
          {apps.map((app) => (
            <tr>
              <td data-label="App">{app.name}</td>
              <td data-label="Access sent to" class="muted">
                {app.host ?? "unknown"}
              </td>
              <td data-label="Connected" class="muted">
                {app.approvedAt ? app.approvedAt.slice(0, 10) : "unknown"}
              </td>
              <td data-label="Action" class="col-actions">
                <form
                  method="post"
                  action={`/dashboard/connected-apps/${encodeURIComponent(app.grantId)}/revoke`}
                  class="inline"
                  onsubmit="return confirm('Disconnect this app? It loses access immediately and would need you to sign in again.')"
                >
                  <Button size="sm">Disconnect</Button>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
