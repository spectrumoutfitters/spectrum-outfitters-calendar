/**
 * Admin Security on-prem config payload.
 * IP lines: split on newline, trim, drop falsy (empty / whitespace).
 * Geofence: all three fields must be truthy (numeric 0 / '' wipe the fence; string '0' is kept).
 */

export function parseAllowedIpLines(text) {
  return String(text ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
}

export function buildOnPremGeofence(lat, lng, radius) {
  if (lat && lng && radius) {
    return {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radiusMeters: parseFloat(radius),
    };
  }
  return null;
}

export function buildOnPremConfigPayload({ allowedIpText, lat, lng, radius } = {}) {
  return {
    allowedIPs: parseAllowedIpLines(allowedIpText),
    geofence: buildOnPremGeofence(lat, lng, radius),
  };
}
