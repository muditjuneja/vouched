import { NavItem } from "../../design";
import { DISPLAY_NAME } from "../../lib/product";

interface NavEntry {
  href: string;
  label: string;
  /** Whether this entry is the current page: a prefix match so e.g. /dashboard/websites/:id/edit still highlights "Websites". */
  match: (path: string) => boolean;
}

const NAV_ENTRIES: NavEntry[] = [
  { href: "/dashboard", label: "Overview", match: (path) => path === "/dashboard" },
  { href: "/dashboard/websites", label: "Websites", match: (path) => path.startsWith("/dashboard/websites") },
  { href: "/dashboard/usage", label: "Usage", match: (path) => path.startsWith("/dashboard/usage") },
  { href: "/dashboard/billing", label: "Billing", match: (path) => path.startsWith("/dashboard/billing") },
  { href: "/dashboard/settings", label: "Settings", match: (path) => path.startsWith("/dashboard/settings") }
];

/** activePath is computed server-side per page (each render*Page() knows which page it is), never from the request path directly: see Layout.tsx's doc comment. */
export function Sidebar({ activePath }: { activePath: string }) {
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
      <a class="dash-back-link" href="/">
        ← Back to site
      </a>
    </nav>
  );
}
