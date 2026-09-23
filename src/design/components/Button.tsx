import type { PropsWithChildren } from "hono/jsx";

export interface ButtonProps {
  /** Renders as an `<a>` styled like a button instead of a `<button>`. */
  href?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  type?: "button" | "submit";
  /** Rare, deliberate escape hatch, only used for the one native `confirm()` prompt (revoking an API key). Never used to embed tenant-controlled text. */
  onclick?: string;
  style?: string;
}

export function Button({ href, variant = "secondary", size, type = "submit", onclick, style, children }: PropsWithChildren<ButtonProps>) {
  const base = variant === "primary" ? "btn btn-primary" : "btn";
  const cls = size === "sm" ? `${base} btn-sm` : base;
  if (href) {
    return (
      <a class={cls} href={href} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} class={cls} onclick={onclick} style={style}>
      {children}
    </button>
  );
}

