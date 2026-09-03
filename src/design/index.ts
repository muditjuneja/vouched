/**
 * Barrel export for the shared design system — the tokens/base styles and
 * small components every rendered surface (marketing, dashboard) composes
 * pages from. Import from here (`../design`), not the individual files,
 * except where a file itself needs to avoid a circular import.
 */
export { TOKENS_CSS } from "./tokens";
export { BASE_CSS } from "./base-styles";
export { FAVICON_HREF } from "./favicon";
export { renderToString } from "./render";
export { Button, type ButtonProps } from "./components/Button";
export { Badge, type BadgeProps, type BadgeStatus } from "./components/Badge";
export { Callout } from "./components/Callout";
export { Card, type CardProps } from "./components/Card";
export { Table, type TableProps } from "./components/Table";
