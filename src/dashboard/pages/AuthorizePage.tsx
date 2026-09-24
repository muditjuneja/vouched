import { DISPLAY_NAME } from "../../lib/product";
import { renderPage } from "../Layout";

/**
 * The consent screen an MCP client (Claude, Cursor, ...) sends a user to
 * when connecting. What it must show comes from the MCP authorization spec:
 * the client's name, where the access will go (the redirect host), a
 * warning when that's the user's own machine, and whether the name is
 * verified. Everything client-supplied is attacker-controlled; hono/jsx
 * escapes it.
 */
export interface AuthorizePageData {
  clientName: string;
  /** Set for a Client ID Metadata Document client: the domain that publishes it. Null for self-registered (DCR) clients. */
  publisherDomain: string | null;
  redirectHost: string;
  signedInAs: string | null;
  /** Whose workspace the connection will use: the user's own, or their team's. */
  workspaceLabel: string;
  /** One-time form handle from beginConsent(). */
  handle: string;
}

const LOCAL_HOST = /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/;

function AuthorizePage({ data }: { data: AuthorizePageData }) {
  const local = LOCAL_HOST.test(data.redirectHost);
  return (
    <div class="auth-card">
      <div class="auth-brand">
        <em>{DISPLAY_NAME}</em>
      </div>
      <span class="auth-badge">Connect an app</span>
      <h1 class="auth-title">Allow {data.clientName} to use {DISPLAY_NAME}?</h1>
      <p class="auth-desc">
        {data.publisherDomain ? (
          <>
            Published by <strong>{data.publisherDomain}</strong>.{" "}
          </>
        ) : (
          <>This app registered itself, so its name isn't verified. </>
        )}
        Access will be sent to <strong>{data.redirectHost}</strong>.
      </p>
      {local ? (
        <p class="auth-desc">
          <strong>This sends access to an app on your own computer.</strong> Only continue if you just started connecting from it.
        </p>
      ) : null}

      <ul class="auth-checklist" style="margin-bottom: 1.5rem;">
        <li>
          <span class="auth-check-icon" aria-hidden="true">✓</span>
          <span>Use {DISPLAY_NAME}'s tools in {data.workspaceLabel}: your websites, Search Console and Analytics data, and your plan's market data</span>
        </li>
        <li>
          <span class="auth-check-icon" aria-hidden="true">✓</span>
          <span>Calls count toward your plan's limits, same as an API key</span>
        </li>
        <li>
          <span class="auth-check-icon" aria-hidden="true">✕</span>
          <span>It can't see or change billing, API keys or team settings</span>
        </li>
      </ul>

      <form method="post">
        <input type="hidden" name="handle" value={data.handle} />
        <button type="submit" name="decision" value="approve" class="btn btn-primary auth-btn-primary">
          Allow
        </button>
        <button type="submit" name="decision" value="deny" class="btn" style="width: 100%;">
          Deny
        </button>
      </form>

      <p class="auth-desc" style="margin: 1.25rem 0 0; font-size: 0.78rem;">
        {data.signedInAs ? <>Signed in as {data.signedInAs}. </> : null}You can disconnect it anytime in Settings.
      </p>
    </div>
  );
}

export function renderAuthorize(data: AuthorizePageData): string {
  return renderPage({ title: `Connect ${data.clientName}`, activePath: "", hideSidebar: true, children: <AuthorizePage data={data} /> });
}

/** A problem with the connection request itself, shown instead of redirecting when the client can't be trusted with a redirect. */
export function renderAuthorizeError(message: string): string {
  return renderPage({
    title: "Can't connect",
    activePath: "",
    hideSidebar: true,
    children: (
      <div class="auth-card">
        <div class="auth-brand">
          <em>{DISPLAY_NAME}</em>
        </div>
        <span class="auth-badge">Connect an app</span>
        <h1 class="auth-title">This connection can't continue</h1>
        <p class="auth-desc">{message}</p>
        <p class="auth-desc" style="margin: 0;">Go back to the app and start connecting again.</p>
      </div>
    )
  });
}
