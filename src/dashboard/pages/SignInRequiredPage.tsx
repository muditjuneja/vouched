import { DISPLAY_NAME } from "../../lib/product";
import { GITHUB_URL } from "../../marketing/github-url";
import { renderPage } from "../Layout";

/** `devBrowserToken` is only set on a development Clerk instance, see DashboardAuthResult.devBrowserToken. */
function buildTarget(currentUrl: string, signInUrl: string | null, devBrowserToken: string | null): string | null {
  if (!signInUrl) return null;
  const url = new URL(signInUrl);
  url.searchParams.set("redirect_url", currentUrl);
  if (devBrowserToken) url.searchParams.set("__clerk_db_jwt", devBrowserToken);
  return url.toString();
}

function SignInPage({ currentUrl, signInUrl, devBrowserToken }: { currentUrl: string; signInUrl: string | null; devBrowserToken: string | null }) {
  const target = buildTarget(currentUrl, signInUrl, devBrowserToken);
  return (
    <>
      <div class="auth-card">
        <div class="auth-brand">
          <em>{DISPLAY_NAME}</em>
        </div>
        <span class="auth-badge">Cloud Dashboard</span>
        <h1 class="auth-title">Sign in to your account</h1>
        <p class="auth-desc">
          Connect your Google Search Console properties, manage tracked domains, and generate MCP API keys for Claude and Cursor.
        </p>

        {target ? (
          <a class="btn btn-primary auth-btn-primary" href={target}>
            Sign in to continue →
          </a>
        ) : (
          <div class="dash-alert dash-alert-warn" style="margin-bottom: 1.25rem; text-align: left; font-size: 0.8rem;">
            No sign-in page is configured on this deployment (<code>CLERK_SIGN_IN_URL</code> is unset).
          </div>
        )}

        <ul class="auth-checklist">
          <li>
            <span class="auth-check-icon" aria-hidden="true">✓</span>
            <span>Automatic workspace setup on first sign-in</span>
          </li>
          <li>
            <span class="auth-check-icon" aria-hidden="true">✓</span>
            <span>Direct Google Search Console & Analytics OAuth</span>
          </li>
          <li>
            <span class="auth-check-icon" aria-hidden="true">✓</span>
            <span>Pre-configured DataForSEO quota on hosted plans</span>
          </li>
        </ul>
      </div>

      <div class="auth-footer">
        <a href="/">← Return to home page</a>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          Self-host Community ($0) →
        </a>
      </div>
    </>
  );
}

export function renderSignInRequired(currentUrl: string, signInUrl: string | null, devBrowserToken: string | null = null): string {
  return renderPage({
    title: "Sign in",
    activePath: "",
    hideSidebar: true,
    children: <SignInPage currentUrl={currentUrl} signInUrl={signInUrl} devBrowserToken={devBrowserToken} />
  });
}
