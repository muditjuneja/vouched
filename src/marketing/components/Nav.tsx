import { ICON_SMALL_SVG } from "../brand-assets.generated";
import { DISPLAY_NAME } from "../brand";
import { GITHUB_URL } from "../github-url";

export interface NavProps {
  /** When false (the self-host default), "Cloud" would link to a dead `/dashboard` 404 (see src/dashboard/routes.ts's gate), so that link is omitted. */
  cloudMode: boolean;
  /** A signed-in visitor sees "Dashboard" instead of "Cloud". */
  signedIn?: boolean;
}

export function Nav({ cloudMode, signedIn = false }: NavProps) {
  return (
    <nav class="nav">
      <a class="brand" href="/">
        <span class="brand-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_SMALL_SVG }} />
        <em>{DISPLAY_NAME}</em>
      </a>
      <div class="nav-links">
        <a href="/docs">Docs</a>
        <a href="/pricing">Pricing</a>
        <a href={GITHUB_URL}>GitHub</a>
        {cloudMode ? (
          <a class="btn" href="/dashboard">
            {signedIn ? "Dashboard" : "Cloud"}
          </a>
        ) : null}
      </div>
    </nav>
  );
}
