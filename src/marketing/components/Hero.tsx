import type { Child, PropsWithChildren } from "hono/jsx";

export interface HeroProps {
  /** Usually plain text, but the tool-page hero needs an inline `<code>` — so this accepts any JSX child, not just a string. */
  eyebrow: Child;
  heading: string;
  lede?: string;
}

/** The `<section class="hero">` every page opens with — eyebrow, the page's one `<h1>`, an optional lede, then anything else (a CTA row) as children. */
export function Hero({ eyebrow, heading, lede, children }: PropsWithChildren<HeroProps>) {
  return (
    <section class="hero">
      <p class="eyebrow">{eyebrow}</p>
      <h1>{heading}</h1>
      {lede ? <p class="lede">{lede}</p> : null}
      {children}
    </section>
  );
}
