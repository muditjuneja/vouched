import type { PropsWithChildren } from "hono/jsx";

export interface CardProps {
  title?: string;
  /** Renders the card as an `<a>` (the marketing tool-index grid links each card to its tool page). */
  href?: string;
}

export function Card({ title, href, children }: PropsWithChildren<CardProps>) {
  const body = (
    <>
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
