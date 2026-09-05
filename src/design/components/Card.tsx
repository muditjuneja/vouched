import type { Child, PropsWithChildren } from "hono/jsx";

export interface CardProps {
  title?: string;
  /** Renders the card as an `<a>` (the marketing tool-index grid links each card to its tool page). */
  href?: string;
  /** An icon element (e.g. from src/marketing/components/icons.tsx), shown above the title in the shared .card-icon treatment. */
  icon?: Child;
}

export function Card({ title, href, icon, children }: PropsWithChildren<CardProps>) {
  const body = (
    <>
      {icon ? <span class="card-icon">{icon}</span> : null}
      {title ? <h3>{title}</h3> : null}
      {children}
    </>
  );
  if (href) {
    return (
      <a class="card" href={href}>
        {body}
      </a>
    );
  }
  return <div class="card">{body}</div>;
}
