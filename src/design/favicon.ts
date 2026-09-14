/**
 * Inline SVG data URI — this Worker has no static-asset pipeline.
 * Ink paper square + a small check, matching Vouched (not the old blue SaaS mark).
 */
const FAVICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23f3eadc'/><rect x='1' y='1' width='30' height='30' rx='5' fill='none' stroke='%231a1916' stroke-width='1.25'/><path d='M9 17l5 5 9-11' stroke='%233f5340' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round' fill='none'/></svg>`;

export const FAVICON_HREF = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;
