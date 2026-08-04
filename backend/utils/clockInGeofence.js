/**
 * Pure clock-in geofence evaluation (haversine + hard/soft/off enforcement).
 * Kept in sync with backend/routes/timeEntries.js clock-in path.
 */

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Evaluate whether a clock-in should proceed given optional lat/lng and fence settings.
 *
 * @returns {{
 *   allowed: boolean,
 *   distanceMeters: number|null,
 *   locationVerified: 0|1,
 *   geofenceWarning: null|{message: string, distanceMeters: number, radiusMeters: number},
 *   violation: null|{code: string, error: string, distanceMeters: number, radiusMeters: number}
 * }}
 */
export function evaluateClockInGeofence({
  lat,
  lng,
  fenceLat,
  fenceLng,
  radiusMeters,
  enforcement,
} = {}) {
  const result = {
    allowed: true,
    distanceMeters: null,
    locationVerified: 0,
    geofenceWarning: null,
    violation: null,
  };

  if (lat == null || lng == null) return result;

  const mode = enforcement || 'off';
  if (mode === 'off') return result;
  if (fenceLat == null || fenceLat === '' || fenceLng == null || fenceLng === '') {
    return result;
  }

  const fLat = parseFloat(fenceLat);
  const fLng = parseFloat(fenceLng);
  if (!Number.isFinite(fLat) || !Number.isFinite(fLng)) return result;

  const radius = parseFloat(radiusMeters ?? '300');
  const safeRadius = Number.isFinite(radius) ? radius : 300;

  const distanceMeters = haversineMeters(
    parseFloat(lat),
    parseFloat(lng),
    fLat,
    fLng
  );
  result.distanceMeters = distanceMeters;

  if (distanceMeters <= safeRadius) {
    result.locationVerified = 1;
    return result;
  }

  const rounded = Math.round(distanceMeters);
  if (mode === 'hard') {
    result.allowed = false;
    result.violation = {
      code: 'GEOFENCE_VIOLATION',
      error: 'You must be at the shop to clock in.',
      distanceMeters: rounded,
      radiusMeters: safeRadius,
    };
    return result;
  }

  // soft (or any non-hard enforcement that is not off)
  result.geofenceWarning = {
    message: `You appear to be ${rounded}m from the shop (limit: ${safeRadius}m). Clock-in recorded but flagged.`,
    distanceMeters: rounded,
    radiusMeters: safeRadius,
  };
  return result;
}
