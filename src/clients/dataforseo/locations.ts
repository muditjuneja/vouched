/**
 * DataForSEO location/language codes. Only the OFE envelope's own default
 * (United States / English) is wired up for v1 — overriding location is a
 * fast-follow (the manifest tool inputs would need a location/language
 * pair, matching the "don't silently change only one" rule OpenRush itself
 * documents).
 */
export const DEFAULT_LOCATION_CODE = 2840; // United States
export const DEFAULT_LANGUAGE_CODE = "en";
