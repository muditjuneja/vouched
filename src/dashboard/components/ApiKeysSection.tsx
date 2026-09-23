import { Button, Table } from "../../design";
import type { SettingsData } from "../types";

export function ApiKeysSection({ data }: { data: SettingsData }) {
  return (
    <section class="panel">
      <h2>MCP API keys</h2>
      <p class="muted">
        Use one of these to connect this server to Claude/an MCP client: add it as <code>Authorization: Bearer &lt;key&gt;</code>. Each
        key is shown once, at creation.
      </p>
      {data.apiKeys.length > 0 && (
        <Table headers={["Label", "Created", "Last used", ""]}>
          {data.apiKeys.map((key) => (
            <tr>
              <td data-label="Label">{key.label ?? "(unlabeled)"}</td>
              <td class="muted" data-label="Created">
                {key.created_at}
              </td>
              <td class="muted" data-label="Last used">
                {key.last_used_at ?? "never used"}
              </td>
              <td data-label="Action" class="col-actions">
                <form
                  method="post"
                  action={`/dashboard/api-keys/${key.key_id}/revoke`}
                  class="inline"
                  onsubmit="return confirm('Revoke this key? Anything using it will stop working immediately.')"
                >
                  <Button size="sm">Revoke</Button>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <form method="post" action="/dashboard/api-keys" class="row" style="margin-top:0.75rem">
        <input name="label" placeholder="e.g. my laptop" />
        <Button variant="primary" size="sm">Create new key</Button>
      </form>
    </section>
  );
}
