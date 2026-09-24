import { Button, Table } from "../../design";
import type { McpApiKeyRow } from "../../db/mcp-api-keys";

const DRAWER_TOGGLE_ID = "create-api-key-toggle";

/** Same CSS-only slide-over as the Add website drawer (checkbox + labels, no client JS). */
function CreateKeyDrawer({ open }: { open: boolean }) {
  return (
    <div class="drawer-wrapper">
      <input type="checkbox" id={DRAWER_TOGGLE_ID} class="drawer-toggle-input" checked={open} />
      <label for={DRAWER_TOGGLE_ID} class="drawer-backdrop" aria-hidden="true" />
      <aside class="widget panel slide-drawer" aria-label="Create an MCP API key">
        <div class="drawer-header">
          <div>
            <h2>New API key</h2>
            <p class="muted drawer-subtitle">Connects Claude or any MCP client to your workspace.</p>
          </div>
          <label for={DRAWER_TOGGLE_ID} class="drawer-close" aria-label="Close">
            ✕
          </label>
        </div>
        <form method="post" action="/dashboard/api-keys" class="drawer-form">
          <div class="form-group">
            <label for="api-key-label" class="form-label">
              Label <span class="muted font-normal">(optional)</span>
            </label>
            <input id="api-key-label" name="label" placeholder="e.g. my laptop" maxlength={80} class="form-input" />
          </div>
          <p class="muted drawer-empty-text">
            The key is shown once, on the next screen, with setup snippets for Claude Code, Claude Desktop and Cursor. Only a hash is
            stored, so copy it before leaving that page.
          </p>
          <div class="drawer-actions">
            <button type="submit" class="btn btn-primary btn-sm">
              Create key
            </button>
            <label for={DRAWER_TOGGLE_ID} class="btn btn-sm drawer-cancel-btn">
              Cancel
            </label>
          </div>
        </form>
      </aside>
    </div>
  );
}

/** Opens the create-key drawer; lives in the page header, like Add website. */
export function NewKeyButton() {
  return (
    <label for={DRAWER_TOGGLE_ID} class="btn btn-primary drawer-open-btn">
      + New key
    </label>
  );
}

/** `openCreate` starts with the drawer open, for links like Overview's "Create API key". */
export function ApiKeysSection({ apiKeys, openCreate = false }: { apiKeys: McpApiKeyRow[]; openCreate?: boolean }) {
  return (
    <section class="panel">
      <p class="muted">
        Use one of these to connect Claude or another MCP client: send it as <code>Authorization: Bearer &lt;key&gt;</code>. Each key is
        shown once, at creation.
      </p>
      {apiKeys.length > 0 && (
        <Table headers={["Label", "Created", "Last used", ""]}>
          {apiKeys.map((key) => (
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
      {apiKeys.length === 0 ? <p class="muted">No keys yet. Create one to connect Claude or another MCP client.</p> : null}
      <CreateKeyDrawer open={openCreate} />
    </section>
  );
}
