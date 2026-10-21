/**
 * Favicon URLs, served by src/marketing/routes.ts. Real files rather than a
 * data URI so favicon crawlers can fetch them. The SVG is the small-size
 * mark (heavier strokes, from assets/brand/mark-small.svg) so it stays
 * crisp at 16px; the ICO holds 16/32/48px renders of it for crawlers and
 * browsers that don't take SVG. Link the ICO with `sizes="48x48"`, not
 * "any", or Chrome picks it over the SVG.
 */
export const FAVICON_HREF = "/favicon.svg";
export const FAVICON_ICO_HREF = "/favicon.ico";
