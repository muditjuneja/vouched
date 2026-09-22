import type { Child } from "hono/jsx";

export interface NavItemProps {
  href: string;
  label: string;
  icon?: Child;
  /** Server-computed: does this item match the page currently being rendered. */
  active: boolean;
}

/** A single sidebar/nav link, styled distinctly when it's the current page. */
export function NavItem({ href, label, icon, active }: NavItemProps) {
  return (
    <a class={active ? "nav-item nav-item-active" : "nav-item"} href={href} aria-current={active ? "page" : undefined}>
      {icon ? <span class="nav-item-icon">{icon}</span> : null}
      {label}
    </a>
  );
}
