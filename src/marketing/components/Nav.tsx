import { DISPLAY_NAME } from "../brand";
import { GITHUB_URL } from "../github-url";

export interface NavProps {
  /** When false (the self-host default), "Cloud" would link to a dead `/dashboard` 404 (see src/dashboard/routes.ts's gate), so that link is omitted. */
  cloudMode: boolean;
}

export function Nav({ cloudMode }: NavProps) {
  return (
    <nav class="nav">
      <a class="brand" href="/">
        <em>{DISPLAY_NAME}</em>
      </a>
      <div class="nav-links">
        <a href="/tools">Tools</a>
        <a href="/pricing">Pricing</a>
        <a href="/vs/open-seo">vs OpenRush</a>
        <a href={GITHUB_URL}>GitHub</a>
        {cloudMode ? (
          <a class="btn" href="/dashboard">
            Cloud
          </a>
        ) : null}
      </div>
    </nav>
  );
}
