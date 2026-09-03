import { Button, Table } from "../../design";
import type { DashboardData } from "../types";

export function ApiKeysSection({ data }: { data: DashboardData }) {
  return (
    <section>
      <h2>MCP API keys</h2>
      <p class="muted">
        Use one of these to connect this server to Claude/an MCP client — add it as <code>Authorization: Bearer &lt;key&gt;</code>. Each
        key is shown once, at creation.
      </p>
      {data.apiKeys.length > 0 && (
        <Table headers={["Label", "Created", "Last used", ""]}>
          {data.apiKeys.map((key) => (
            <tr>
              <td>{key.label ?? "(unlabeled)"}</td>
              <td class="muted">{key.created_at}</td>
              <td class="muted">{key.last_used_at ?? "never used"}</td>
              <td>
                <form
                  method="post"
                  action={`/dashboard/api-keys/${key.key_id}/revoke`}
                  class="inline"
                  onsubmit="return confirm('Revoke this key? Anything using it will stop working immediately.')"
                >
                  <Button>Revoke</Button>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <form method="post" action="/dashboard/api-keys" class="row" style="margin-top:0.75rem">
        <input name="label" placeholder="e.g. my laptop" />
        <Button variant="primary">Create new key</Button>
      </form>
    </section>
  );
}
