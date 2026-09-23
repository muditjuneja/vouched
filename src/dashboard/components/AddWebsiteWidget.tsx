import { Callout } from "../../design";
import type { DiscoveredProperty } from "../discovery";
import type { WebsitesData } from "../types";
import { ConnectionBadge } from "./ConnectionBadge";

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
      <span class="widget-connect-label">{label}</span>
      <div class="widget-connect-action">
        <ConnectionBadge state={state} />
        {googleOAuthConfigured && state !== "connected" ? (
          <a href={`/oauth/google/start?scope=${scope}&returnTo=websites`} class="btn btn-sm btn-primary">
            {state === "reconnect_required" ? "Reconnect" : "Connect"}
          </a>
        ) : null}
      </div>
    </div>
  );
}

const DRAWER_TOGGLE_ID = "add-website-toggle";

/** One discovered property, tracked with a single click via hidden fields, no typing. */
function DiscoveredRow({ property }: { property: DiscoveredProperty }) {
  const source = property.gscSiteUrl && property.ga4PropertyId ? "Search Console + Analytics" : property.gscSiteUrl ? "Search Console" : "Analytics";
  return (
    <form method="post" action="/dashboard/websites" class="discovered-row">
      <input type="hidden" name="name" value={property.name} />
      <input type="hidden" name="primaryDomain" value={property.primaryDomain} />
      {property.gscSiteUrl ? <input type="hidden" name="gscSiteUrl" value={property.gscSiteUrl} /> : null}
      {property.ga4PropertyId ? <input type="hidden" name="ga4PropertyId" value={property.ga4PropertyId} /> : null}
      <div>
        <div class="discovered-row-name">{property.name}</div>
        <div class="muted discovered-row-source">{source}</div>
      </div>
      <button type="submit" class="btn btn-sm btn-primary">
        Track
      </button>
    </form>
  );
}

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
 * No manual name/domain form: every website tracked here is discovered
 * from a connected Google account and tracked with one click (see
 * discovery.ts). There's nothing to type because there's nothing this
 * server can't already tell the tenant about their own properties, and a
 * hand-typed domain with no matching GSC/GA4 property couldn't power any
 * of the tools that make a "tracked website" useful in the first place.
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
          <div>
            <h2>Add a website</h2>
            <p class="muted drawer-subtitle">
              Discovered from your connected Google Search Console or Analytics account.
            </p>
          </div>
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
          <>
            <div class="widget-connections">
              <ConnectRow label="Search Console" scope="webmaster_console" state={data.gscState} googleOAuthConfigured={data.googleOAuthConfigured} />
              <ConnectRow label="Analytics" scope="analytics_property" state={data.ga4State} googleOAuthConfigured={data.googleOAuthConfigured} />
            </div>
            {data.gscState !== "connected" && data.ga4State !== "connected" ? (
              <p class="muted drawer-empty-text">Connect or reconnect Search Console/Analytics above to see your properties here.</p>
            ) : data.discovered.length === 0 ? (
              <p class="muted drawer-empty-text">No new properties found. Everything your connected Google account can see is already tracked.</p>
            ) : (
              <div class="discovered-list">
                {data.discovered.map((property) => (
                  <DiscoveredRow property={property} />
                ))}
              </div>
            )}
          </>
        ) : (
          <p class="muted drawer-empty-text">Google OAuth isn't configured on this deployment yet.</p>
        )}
      </aside>
    </>
  );
}
