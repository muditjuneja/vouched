import type { Child, PropsWithChildren } from "hono/jsx";
import { AskAiBar } from "./AskAiBar";
import { GlobeBackdrop } from "./GlobeBackdrop";

export interface HeroProps {
  /** Usually plain text, but the tool-page hero needs an inline `<code>`, so this accepts any JSX child, not just a string. */
  eyebrow: Child;
  /** Usually plain text; the landing page wraps part of it in a `<span class="gradient-text">`. */
  heading: Child;
  lede?: string;
  /** An optional visual (e.g. a <CodeWindow>) rendered beside the copy in a two-column layout: only the landing page uses this, every other page stays single-column. */
  visual?: Child;
}

/** The `<section class="hero">` every page opens with: eyebrow, the page's one `<h1>`, an optional lede, then anything else (a CTA row) as children. */
export function Hero({ eyebrow, heading, lede, visual, children }: PropsWithChildren<HeroProps>) {
  const copy = (
    <div class="hero-copy">
      <p class="eyebrow">{eyebrow}</p>
      <h1>{heading}</h1>
      {lede ? <p class="lede">{lede}</p> : null}
      {children}
    </div>
  );

  if (visual) {
    return (
      <section class="hero">
        <GlobeBackdrop />
        <div class="hero-grid">
          {copy}
          <div class="hero-visual">{visual}</div>
        </div>
        <AskAiBar />
      </section>
    );
  }

  return (
    <section class="hero hero-inner">
      {copy}
    </section>
  );
}
