/**
 * No static-asset pipeline exists in this Worker (no R2/KV-backed public
 * dir, no `wrangler.jsonc` assets binding) — an inline SVG data URI is the
 * only favicon option that needs no deploy-time asset step. A rounded
 * square in the brand accent color with a checkmark, echoing the "SEO
 * data with receipts" positioning (see the landing page hero).
 */
const FAVICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%232952e3'/><path d='M9 17l5 5 9-11' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' fill='none'/></svg>`;

export const FAVICON_HREF = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;
