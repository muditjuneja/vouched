import type { PropsWithChildren } from "hono/jsx";
import { Button } from "../../design";

export interface PricingCardProps {
  name: string;
  price: string;
  priceNote: string;
  ctaLabel: string;
  /** Null when this plan isn't reachable on the current deployment (e.g. a cloud plan on a self-host-only instance): the card renders without a CTA in that case, since the accompanying explanatory text already covers why. */
  ctaHref: string | null;
  featured?: boolean;
  primaryCta?: boolean;
}

export function PricingCard({ name, price, priceNote, ctaLabel, ctaHref, featured, primaryCta, children }: PropsWithChildren<PricingCardProps>) {
  return (
    <div class={featured ? "price-card featured" : "price-card"}>
      <h3>{name}</h3>
      <p class="price-amount">
        {price}
        <small>{priceNote}</small>
      </p>
      {children}
      {ctaHref ? (
        <Button href={ctaHref} variant={primaryCta ? "primary" : "secondary"}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}
