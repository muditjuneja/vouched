/**
 * hono/jsx's `JSXNode.toString()` is typed `string | Promise<string>` since
 * hono/jsx supports async components, but every component under
 * src/design, src/marketing, and src/dashboard is a plain synchronous
 * function (no async component, no <Suspense>), so rendering one always
 * resolves synchronously in practice. This narrows that at the one place
 * page-level render functions convert a JSX tree to the plain `string`
 * Hono route handlers (and this codebase's existing tests) expect,
 * instead of every call site re-deriving the same "should be unreachable"
 * check.
 */
interface Stringifiable {
  toString(): string | Promise<string>;
}

export function renderToString(node: Stringifiable): string {
  const out = node.toString();
  if (typeof out !== "string") {
    throw new Error(
      "a component rendered asynchronously: every component under src/design/src/marketing/src/dashboard is expected to stay synchronous"
    );
  }
  return out;
}
