/**
 * DataForSEO location/language codes. Only the OFE envelope's own default
 * (United States / English) is wired up for v1. Overriding location is a
 * fast-follow: the tool inputs would take a location/language pair, so a
 * caller never changes only one of the two.
 */
export const DEFAULT_LOCATION_CODE = 2840; // United States
export const DEFAULT_LANGUAGE_CODE = "en";
