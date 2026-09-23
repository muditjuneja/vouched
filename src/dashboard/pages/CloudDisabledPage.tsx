import { Callout } from "../../design";
import { DISPLAY_NAME } from "../../lib/product";
import { GITHUB_URL } from "../../marketing/github-url";
import { renderPage } from "../Layout";

/**
 * What a visitor sees when they land on any `/dashboard/*` route on a
 * deployment where cloud mode isn't configured (CLOUD_MODE and/or
 * CLERK_SECRET_KEY unset, see `isCloudMode` in src/types/env.ts). This is
 * intentionally still a 404: the route genuinely doesn't exist on this
 * deployment, and the status code should say so. Only the response body
 * changes, from a bare `c.text("not found", 404)` to a real page, since a
 * visitor who lands here (a stale bookmark, a search result, a link from
 * elsewhere) deserves an explanation instead of a plaintext dead end.
 */
function CloudDisabledPage() {
  return (
    <>
      <h1>No cloud dashboard here</h1>
      <p>
        This is a self-hosted deployment of <strong>{DISPLAY_NAME}</strong>, and the hosted cloud dashboard (sign-in, billing, a managed
        DataForSEO key) isn't enabled on it. That's expected: self-host mode has no dashboard by design, only the MCP server itself.
      </p>
      <Callout>
        <p>
          If you run this deployment: the dashboard only turns on once <code>CLOUD_MODE</code> and <code>CLERK_SECRET_KEY</code> are both
          set (see <code>docs/CLOUD.md</code>). Leave them unset to stay in plain self-host mode.
        </p>
        <p>
          If you're just visiting: there's no cloud sign-in to reach on this particular deployment. The project itself is free to
          self-host, MIT licensed, with no dashboard required to use it.
        </p>
      </Callout>
      <p>
        <a href={GITHUB_URL}>View the source and self-host guide on GitHub →</a>
      </p>
    </>
  );
}

export function renderCloudDisabled(): string {
  return renderPage({
    title: "Dashboard not available",
    activePath: "",
    hideSidebar: true,
    children: (
      <div class="auth-card" style="max-width: 34rem; text-align: left;">
        <CloudDisabledPage />
      </div>
    )
  });
}
