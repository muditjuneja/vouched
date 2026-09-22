import { Callout } from "../../design";
import type { WebsitesData } from "../types";
import { ConnectionBadge } from "./ConnectionBadge";
import { Ga4PropertyField, GscSiteField } from "./GoogleAssetFields";

const SCOPE_LABEL = { webmaster_console: "Search Console", analytics_property: "Analytics" } as const;

function ConnectRow({
  label,
  scope,
  state,
  googleOAuthConfigured
}: {
  label: string;
  scope: "webmaster_console" | "analytics_property";
  state: WebsitesData["gscState"];
  googleOAuthConfigured: boolean;
}) {
  return (
    <div class="widget-connect-row">
      <span>{label}</span>
      <ConnectionBadge state={state} />
      {googleOAuthConfigured && state !== "connected" ? (
        <a href={`/oauth/google/start?scope=${scope}&returnTo=websites`}>{state === "reconnect_required" ? "Reconnect" : "Connect"}</a>
      ) : null}
    </div>
  );
}

const DRAWER_TOGGLE_ID = "add-website-toggle";

/**
 * A slide-over drawer (CSS-only, no client JS), not an always-visible
 * sidebar column: the "Add website" button opens it, and it closes via
 * its own X, a backdrop click, or the same button again. Uses the
 * checkbox+label toggle pattern rather than this codebase's usual
 * <details>/<summary> disclosure (see Layout.tsx's mobile nav) because a
 * drawer needs several independent things to toggle the same open state
 * from different places in the DOM (open button, in-panel close, click-
 * outside backdrop): <details> only recognizes its own first <summary>
 * as a toggle, a checkbox's paired <label for=...> has no such limit.
 *
 * Connecting Google lives here too, not just in Settings: connecting and
 * adding a website are the same moment for a first-time tenant. Settings
 * keeps its own copy of the connect action (see ConnectionsSection) plus
 * the only disconnect action, since disconnecting isn't tied to any one
 * website.
 */
export function AddWebsiteWidget({ data }: { data: WebsitesData }) {
  return (
    <>
      {/* checked when the OAuth callback just redirected back here, so the confirmation banner inside isn't hidden behind a closed drawer. */}
      <input type="checkbox" id={DRAWER_TOGGLE_ID} class="drawer-toggle-input" checked={data.justConnected !== null} />
      <label for={DRAWER_TOGGLE_ID} class="btn btn-primary drawer-open-btn">
        + Add website
      </label>
      <label for={DRAWER_TOGGLE_ID} class="drawer-backdrop" aria-hidden="true" />
      <aside class="widget panel add-website-drawer">
        <div class="drawer-header">
          <h2>Add a website</h2>
          <label for={DRAWER_TOGGLE_ID} class="drawer-close" aria-label="Close">
            ✕
          </label>
        </div>
        {data.justConnected ? (
          <Callout>
            <p>{SCOPE_LABEL[data.justConnected]} connected. Its properties now show up below.</p>
          </Callout>
        ) : null}
        {data.googleOAuthConfigured ? (
          <div class="widget-connections">
            <ConnectRow label="Search Console" scope="webmaster_console" state={data.gscState} googleOAuthConfigured={data.googleOAuthConfigured} />
            <ConnectRow label="Analytics" scope="analytics_property" state={data.ga4State} googleOAuthConfigured={data.googleOAuthConfigured} />
          </div>
        ) : (
          <p class="muted">Google OAuth isn't configured on this deployment yet.</p>
        )}
        <form method="post" action="/dashboard/websites" class="stacked-form">
          <label>
            Display name
            <input name="name" placeholder="My Site" required />
          </label>
          <label>
            Domain
            <input name="primaryDomain" placeholder="example.com" required />
          </label>
          <label>
            Search Console property
            <GscSiteField sites={data.gscSites} />
          </label>
          <label>
            Analytics property
            <Ga4PropertyField properties={data.ga4Properties} />
          </label>
          <button type="submit" class="btn btn-primary">
            Add website
          </button>
        </form>
      </aside>
    </>
  );
}
