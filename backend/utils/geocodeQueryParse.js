/**
 * Pure helpers for geocode / suggest / street-view query validation and
 * Nominatim coordinate parsing. Extracted from routes/geocode.js — keep
 * behavior identical.
 */

export function normalizeQuery(value) {
  return (value || '').trim();
}

/** GET /geocode: empty or shorter than 5 characters after trim is invalid. */
export function isGeocodeAddressTooShort(address) {
  const normalized = normalizeQuery(address);
  return !normalized || normalized.length < 5;
}

/** GET /suggest: empty or shorter than 2 characters after trim → no lookup. */
export function isSuggestQueryTooShort(q) {
  const normalized = normalizeQuery(q);
  return !normalized || normalized.length < 2;
}

/**
 * Nominatim uses `lat` / `lon`. NaN on either coordinate is invalid.
 * `display_name` falls back to `''`.
 */
export function parseNominatimLocation(item) {
  const lat = parseFloat(item?.lat);
  const lng = parseFloat(item?.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    lat,
    lng,
    display_name: item.display_name || '',
  };
}

/**
 * Suggest mapping: non-arrays become []; drop rows with empty display_name
 * or NaN coords. Note: `lat: 0` / `lon: 0` (Gulf of Guinea) is kept.
 */
export function mapNominatimSuggestions(data) {
  return (Array.isArray(data) ? data : [])
    .map((item) => ({
      display_name: item.display_name || '',
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
    }))
    .filter((s) => s.display_name && !Number.isNaN(s.lat) && !Number.isNaN(s.lon));
}

/** Street View: both query params must parse as numbers (0,0 is allowed). */
export function parseStreetViewCoords(lat, lng) {
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) return null;
  return { lat: parsedLat, lng: parsedLng };
}

/**
 * Google Street View often returns HTTP 200 with a JSON error body.
 * Match is case-insensitive substring `'application/json'`.
 */
export function isStreetViewJsonContentType(contentType) {
  return (contentType || '').toLowerCase().includes('application/json');
}
