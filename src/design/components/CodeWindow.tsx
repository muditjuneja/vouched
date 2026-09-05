import type { PropsWithChildren } from "hono/jsx";

export interface CodeWindowProps {
  title?: string;
}

/**
 * A styled "code screenshot": macOS-style window chrome around a
 * monospace block. Used where a real product shot would otherwise go
 * (no image pipeline/design assets exist in this repo); pass pre-built
 * `<span>` children for basic syntax coloring (see the marketing hero's
 * usage) or plain text for an unstyled block.
 */
export function CodeWindow({ title, children }: PropsWithChildren<CodeWindowProps>) {
  return (
    <div class="code-window">
      <div class="code-window-bar">
        <span class="code-window-dot" style="background:#ff5f57" />
        <span class="code-window-dot" style="background:#febc2e" />
        <span class="code-window-dot" style="background:#28c840" />
        {title ? <span class="code-window-title">{title}</span> : null}
      </div>
      <pre class="code-window-body">{children}</pre>
    </div>
  );
}
