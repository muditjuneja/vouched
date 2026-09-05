import { GITHUB_URL } from "../github-url";

export interface NavProps {
  /** When false (the self-host default), "Sign in" would link to a dead `/dashboard` 404 (see src/dashboard/routes.ts's gate), so it's replaced with a real link to the source instead. */
  cloudMode: boolean;
}

export function Nav({ cloudMode }: NavProps) {
  return (
    <nav class="nav">
      <a class="brand" href="/">
        mcp-seo-toolkit
      </a>
      <div class="nav-links">
        <a href="/tools">Tools</a>
        <a href="/pricing">Pricing</a>
        <a href="/vs/ahrefs">Compare</a>
        {cloudMode ? (
          <a class="btn" href="/dashboard">
            Sign in
          </a>
        ) : (
          <a class="btn" href={GITHUB_URL}>
            GitHub
          </a>
        )}
      </div>
    </nav>
  );
}
