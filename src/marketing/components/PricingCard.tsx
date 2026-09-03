import type { PropsWithChildren } from "hono/jsx";
import { Button } from "../../design";

export interface PricingCardProps {
  name: string;
  price: string;
  priceNote: string;
  ctaLabel: string;
  ctaHref: string;
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
      <Button href={ctaHref} variant={primaryCta ? "primary" : "secondary"}>
        {ctaLabel}
      </Button>
    </div>
  );
}
