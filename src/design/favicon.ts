import { ICON_SMALL_SVG } from "../marketing/brand-assets.generated";

/**
 * Inline SVG data URI: saves a request on every page. The small-size mark
 * (heavier strokes) from assets/brand/mark-small.svg, so it stays crisp at
 * 16px.
 */
export const FAVICON_HREF = `data:image/svg+xml,${encodeURIComponent(ICON_SMALL_SVG)}`;
