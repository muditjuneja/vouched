import { renderPage } from "../Layout";

function buildTarget(currentUrl: string, signInUrl: string | null): string | null {
  if (!signInUrl) return null;
  const separator = signInUrl.includes("?") ? "&" : "?";
  return `${signInUrl}${separator}redirect_url=${encodeURIComponent(currentUrl)}`;
}

function SignInRequiredPage({ currentUrl, signInUrl }: { currentUrl: string; signInUrl: string | null }) {
  const target = buildTarget(currentUrl, signInUrl);
  return (
    <>
      <h1>Sign in required</h1>
      {target ? (
        <p>
          <a href={target}>Sign in to continue</a>
        </p>
      ) : (
        <p class="muted">No sign-in page is configured on this deployment (CLERK_SIGN_IN_URL).</p>
      )}
    </>
  );
}

export function renderSignInRequired(currentUrl: string, signInUrl: string | null): string {
  return renderPage({ title: "Sign in", children: <SignInRequiredPage currentUrl={currentUrl} signInUrl={signInUrl} /> });
}
