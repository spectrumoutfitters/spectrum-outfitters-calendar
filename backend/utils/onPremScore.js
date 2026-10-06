/**
 * Login on-prem score used by computeOnPremScore.
 * 50 pts allowlisted network, 30 pts browser geofence, 20 pts IP geofence.
 * Unconfigured checks add partial credit without setting networkOk / geoOk.
 */

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ipToLong(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return parts.reduce((acc, p) => (acc << 8) + parseInt(p, 10), 0) >>> 0;
}

function cidrMatch(ip, cidr) {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1) >>> 0;
  const ipNum = ipToLong(ip);
  const rangeNum = ipToLong(range);
  if (ipNum === null || rangeNum === null) return false;
  return (ipNum & mask) === (rangeNum & mask);
}

function ipMatchesAllowlist(ip, allowedIPs) {
  if (!ip || !allowedIPs?.length) return false;
  const cleaned = ip.replace(/^::ffff:/, '');
  for (const entry of allowedIPs) {
    if (entry.includes('/')) {
      if (cidrMatch(cleaned, entry)) return true;
    } else if (cleaned === entry) {
      return true;
    }
  }
  return false;
}

/**
 * @param {{ ip?: string, allowedIPs: string[], geofence?: { lat: number, lng: number, radiusMeters: number } | null, browserGeo?: { lat?: number, lng?: number } | null, ipGeo?: { lat?: number, lng?: number } | null }} input
 */
export function scoreOnPremPresence({ ip, allowedIPs, geofence, browserGeo, ipGeo }) {
  let score = 0;
  let networkOk = false;
  let geoOk = false;

  if (allowedIPs.length > 0) {
    networkOk = ipMatchesAllowlist(ip, allowedIPs);
    if (networkOk) score += 50;
  } else {
    score += 25;
  }

  if (geofence && browserGeo?.lat != null && browserGeo?.lng != null) {
    const dist = haversineMeters(
      geofence.lat, geofence.lng,
      browserGeo.lat, browserGeo.lng
    );
    if (dist <= geofence.radiusMeters) {
      geoOk = true;
      score += 30;
    }
  } else if (!geofence) {
    score += 15;
  }

  if (geofence && ipGeo?.lat != null && ipGeo?.lng != null) {
    const dist = haversineMeters(
      geofence.lat, geofence.lng,
      ipGeo.lat, ipGeo.lng
    );
    if (dist <= (geofence.radiusMeters || 50000) * 3) {
      score += 20;
    }
  } else if (!geofence) {
    score += 10;
  }

  return { networkOk, geoOk, score: Math.min(score, 100) };
}
