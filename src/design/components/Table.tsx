import type { PropsWithChildren } from "hono/jsx";

export interface TableProps {
  headers: string[];
  /** Extra class(es) on the `<table>` itself, e.g. marketing's "compare" for its wider comparison-table styling. */
  class?: string;
}

/** Wraps in `.table-scroll` so a wide table degrades to horizontal scroll on narrow viewports instead of overflowing the page. Pass `<tr>` rows as children. */
export function Table({ headers, class: className, children }: PropsWithChildren<TableProps>) {
  return (
    <div class="table-scroll">
      <table class={className}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
