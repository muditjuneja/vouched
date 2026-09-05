import type { PropsWithChildren } from "hono/jsx";

export interface ButtonProps {
  /** Renders as an `<a>` styled like a button instead of a `<button>`. */
  href?: string;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
  /** Rare, deliberate escape hatch, only used for the one native `confirm()` prompt (revoking an API key). Never used to embed tenant-controlled text. */
  onclick?: string;
}

export function Button({ href, variant = "secondary", type = "submit", onclick, children }: PropsWithChildren<ButtonProps>) {
  const cls = variant === "primary" ? "btn btn-primary" : "btn";
  if (href) {
    return (
      <a class={cls} href={href}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} class={cls} onclick={onclick}>
      {children}
    </button>
  );
}
