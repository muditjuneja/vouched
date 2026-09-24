import { NavItem } from "../../design";
import { DISPLAY_NAME } from "../../lib/product";
import type { DashboardUser } from "../types";

interface NavEntry {
  href: string;
  label: string;
  /** Whether this entry is the current page: a prefix match so e.g. /dashboard/websites/:id/edit still highlights "Websites". */
  match: (path: string) => boolean;
}

const NAV_ENTRIES: NavEntry[] = [
  { href: "/dashboard", label: "Overview", match: (path) => path === "/dashboard" },
  { href: "/dashboard/websites", label: "Websites", match: (path) => path.startsWith("/dashboard/websites") },
  { href: "/dashboard/api-keys", label: "API keys", match: (path) => path.startsWith("/dashboard/api-keys") },
  { href: "/dashboard/usage", label: "Usage", match: (path) => path.startsWith("/dashboard/usage") },
  { href: "/dashboard/billing", label: "Billing", match: (path) => path.startsWith("/dashboard/billing") },
  { href: "/dashboard/settings", label: "Settings", match: (path) => path.startsWith("/dashboard/settings") }
];

/** activePath is computed server-side per page (each render*Page() knows which page it is), never from the request path directly: see Layout.tsx's doc comment. */
export function Sidebar({ activePath, user }: { activePath: string; user?: DashboardUser }) {
  const initial = (user?.email ? user.email[0] : "U")?.toUpperCase() ?? "U";

  return (
    <nav class="dash-sidebar">
      <a class="brand" href="/">
        <em>{DISPLAY_NAME}</em>
      </a>
      <div class="dash-nav-items">
        {NAV_ENTRIES.map((entry) => (
          <NavItem href={entry.href} label={entry.label} active={entry.match(activePath)} />
        ))}
      </div>
      {user ? (
        <div class="dash-user-card">
          <div class="dash-user-row">
            <span class="dash-user-avatar">{initial}</span>
            <div class="dash-user-meta">
              <span class="dash-user-email" title={user.email ?? user.tenantId}>
                {user.email ?? user.tenantId}
              </span>
              <span class="dash-plan-badge">{user.plan} plan</span>
            </div>
          </div>
          <div class="dash-user-actions">
            <a href="/docs" class="dash-user-action">
              Docs
            </a>
            <span class="dash-user-action-sep">·</span>
            <a href="/dashboard/settings" class="dash-user-action">
              Settings
            </a>
            <span class="dash-user-action-sep">·</span>
            <a href="/dashboard/logout" class="dash-user-action dash-logout-link">
              Sign out
            </a>
          </div>
          <a class="dash-back-link" href="/">
            ← Public site
          </a>
        </div>
      ) : (
        <a class="dash-back-link" href="/">
          ← Back to site
        </a>
      )}
    </nav>
  );
}

