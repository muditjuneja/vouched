# Vouched brand files

The mark is a check in a bordered paper square (paper `#f3eadc`, ink
`#1a1916`, moss `#3f5340`). The wordmark is "Vouched" in Fraunces italic,
weight 500.

| File | Use it for |
|---|---|
| `mark.svg` | Master mark; anywhere 48px and up |
| `mark-small.svg` | 32px and below (heavier strokes): the site favicon |
| `mark-on-dark.svg` | On dark backgrounds (no border) |
| `mark-120.png` | Google OAuth consent screen logo (must be 120×120) |
| `mark-180.png` | Apple touch icon |
| `mark-512.png` | Directory listings, Clerk and Dodo branding, app icons |
| `lockup.png` / `lockup-dark.png` | Mark + wordmark, transparent, for light / dark backgrounds |
| `og.png` | Link previews (1200×630), served at `/og.png` |

The Worker serves `og.png`, `mark-512.png`, `mark-180.png` and `mark.svg`
(as `/og.png` and `/brand/icon-*`) from an embedded copy. After changing
any of them, run `npm run brand:assets` to regenerate
`src/marketing/brand-assets.generated.ts`.

PNG lockups and `og.png` were rendered from HTML with the real Fraunces
font; the SVG marks contain no text, so they need no font.
