import { renderPage } from "../Layout";

function buildTarget(currentUrl: string, signInUrl: string | null): string | null {
  if (!signInUrl) return null;
  const separator = signInUrl.includes("?") ? "&" : "?";
  return `${signInUrl}${separator}redirect_url=${encodeURIComponent(currentUrl)}`;
}

function SignInRequiredPage({ currentUrl, signInUrl }: { currentUrl: string; signInUrl: string | null }) {
  const target = buildTarget(currentUrl, signInUrl);
  return (
    <div style="max-width: 28rem; margin: 3rem auto 0; text-align: center;">
      <section class="panel" style="padding: 2.2rem 2rem;">
        <h1 style="font-size: 1.8rem; margin-bottom: 0.75rem;">Sign in required</h1>
        <p class="muted" style="margin-bottom: 1.5rem; font-size: 0.92rem;">
          You need an active session to access your dashboard, manage tracked websites, and generate MCP keys.
        </p>
        {target ? (
          <p style="margin: 0;">
            <a class="btn btn-primary" href={target} style="width: 100%; box-sizing: border-box; justify-content: center; padding: 0.75rem 1rem;">
              Sign in to continue →
            </a>
          </p>
        ) : (
          <p class="muted" style="font-size: 0.85rem;">No sign-in page is configured on this deployment (CLERK_SIGN_IN_URL).</p>
        )}
      </section>
      <p style="margin-top: 1rem;">
        <a href="/" class="dash-back-link">← Return to home page</a>
      </p>
    </div>
  );
}

export function renderSignInRequired(currentUrl: string, signInUrl: string | null): string {
  return renderPage({ title: "Sign in", activePath: "", children: <SignInRequiredPage currentUrl={currentUrl} signInUrl={signInUrl} /> });
}

