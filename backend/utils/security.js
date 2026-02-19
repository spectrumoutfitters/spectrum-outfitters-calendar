import geoip from 'geoip-lite';
import db from '../database/db.js';

/**
 * Extract the real client IP from an Express request behind Nginx.
 * Requires app.set('trust proxy', 1) so Express uses X-Forwarded-For.
 */
export function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  if (realIp) return realIp;
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Extract client IP from a Socket.io handshake.
 */
export function getSocketClientIP(socket) {
  const forwarded = socket.handshake.headers?.['x-forwarded-for'];
  const realIp = socket.handshake.headers?.['x-real-ip'];
  if (realIp) return realIp;
  if (forwarded) return forwarded.split(',')[0].trim();
  return socket.handshake.address || 'unknown';
}

/**
 * Look up IP geolocation using MaxMind GeoLite2 (via geoip-lite).
 * Returns { country, region, city, lat, lng, source } or null.
 */
export function lookupIPGeo(ip) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return null;
  const cleaned = ip.replace(/^::ffff:/, '');
  const geo = geoip.lookup(cleaned);
  if (!geo) return null;
  return {
    country: geo.country || null,
    region: geo.region || null,
    city: geo.city || null,
    lat: geo.ll?.[0] ?? null,
    lng: geo.ll?.[1] ?? null,
    source: 'geoip-lite/maxmind'
  };
}

/**
 * Load on-prem configuration from app_settings.
 * Keys: on_prem_allowed_ips, on_prem_geofence
 */
async function loadOnPremConfig() {
  const defaults = {
    allowedIPs: [],
    geofence: null // { lat, lng, radiusMeters }
  };
  try {
    const ipRow = await db.getAsync("SELECT value FROM app_settings WHERE key = 'on_prem_allowed_ips'");
    if (ipRow?.value) defaults.allowedIPs = JSON.parse(ipRow.value);

    const geoRow = await db.getAsync("SELECT value FROM app_settings WHERE key = 'on_prem_geofence'");
    if (geoRow?.value) defaults.geofence = JSON.parse(geoRow.value);
  } catch (_) {}
  return defaults;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function cidrMatch(ip, cidr) {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1) >>> 0;
  const ipNum = ipToLong(ip);
  const rangeNum = ipToLong(range);
  if (ipNum === null || rangeNum === null) return false;
  return (ipNum & mask) === (rangeNum & mask);
}

function ipToLong(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return parts.reduce((acc, p) => (acc << 8) + parseInt(p, 10), 0) >>> 0;
}

/**
 * Compute on-prem checks. Returns { networkOk, geoOk, score }.
 * Score 0-100: 50 pts network, 30 pts browser geo, 20 pts IP geo.
 */
export async function computeOnPremScore(ip, browserGeo, ipGeo) {
  const config = await loadOnPremConfig();
  let score = 0;
  let networkOk = false;
  let geoOk = false;

  // Network check (50 pts)
  if (config.allowedIPs.length > 0) {
    networkOk = ipMatchesAllowlist(ip, config.allowedIPs);
    if (networkOk) score += 50;
  } else {
    // No allowlist configured — skip network scoring
    score += 25;
  }

  // Browser geolocation check (30 pts)
  if (config.geofence && browserGeo?.lat != null && browserGeo?.lng != null) {
    const dist = haversineMeters(
      config.geofence.lat, config.geofence.lng,
      browserGeo.lat, browserGeo.lng
    );
    if (dist <= config.geofence.radiusMeters) {
      geoOk = true;
      score += 30;
    }
  } else if (!config.geofence) {
    score += 15;
  }

  // IP geo check (20 pts) — approximate, city-level
  if (config.geofence && ipGeo?.lat != null && ipGeo?.lng != null) {
    const dist = haversineMeters(
      config.geofence.lat, config.geofence.lng,
      ipGeo.lat, ipGeo.lng
    );
    if (dist <= (config.geofence.radiusMeters || 50000) * 3) {
      score += 20;
    }
  } else if (!config.geofence) {
    score += 10;
  }

  return { networkOk, geoOk, score: Math.min(score, 100) };
}

/**
 * Insert a login_events row.
 */
export async function recordLoginEvent({
  userId, username, success, reason, ip, forwardedFor, userAgent,
  browserGeo, ipGeo, networkOk, geoOk, score
}) {
  try {
    await db.runAsync(`
      INSERT INTO login_events (
        user_id, username, success, reason, ip, forwarded_for, user_agent,
        browser_geo_lat, browser_geo_lng, browser_geo_accuracy_m,
        ip_geo_country, ip_geo_region, ip_geo_city, ip_geo_lat, ip_geo_lng, ip_geo_source,
        on_prem_network_ok, on_prem_geo_ok, on_prem_score
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      userId ?? null,
      username,
      success ? 1 : 0,
      reason ?? null,
      ip ?? null,
      forwardedFor ?? null,
      userAgent ?? null,
      browserGeo?.lat ?? null,
      browserGeo?.lng ?? null,
      browserGeo?.accuracy ?? null,
      ipGeo?.country ?? null,
      ipGeo?.region ?? null,
      ipGeo?.city ?? null,
      ipGeo?.lat ?? null,
      ipGeo?.lng ?? null,
      ipGeo?.source ?? null,
      networkOk ? 1 : 0,
      geoOk ? 1 : 0,
      score ?? 0
    ]);
  } catch (err) {
    console.error('Failed to record login event:', err.message);
  }
}

/**
 * Create a user_sessions row when a socket connects.
 */
export async function startSession(userId, ip, userAgent, socketId) {
  try {
    const result = await db.runAsync(
      `INSERT INTO user_sessions (user_id, ip, user_agent, socket_id, active) VALUES (?,?,?,?,1)`,
      [userId, ip ?? null, userAgent ?? null, socketId ?? null]
    );
    return result.lastID;
  } catch (err) {
    console.error('Failed to start session:', err.message);
    return null;
  }
}

/**
 * End a session when a socket disconnects.
 */
export async function endSession(socketId) {
  try {
    await db.runAsync(
      `UPDATE user_sessions SET active = 0, ended_at = CURRENT_TIMESTAMP WHERE socket_id = ? AND active = 1`,
      [socketId]
    );
  } catch (err) {
    console.error('Failed to end session:', err.message);
  }
}

/**
 * Update last_seen_at (heartbeat).
 */
export async function heartbeatSession(socketId) {
  try {
    await db.runAsync(
      `UPDATE user_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE socket_id = ? AND active = 1`,
      [socketId]
    );
  } catch (err) {
    console.error('Failed to heartbeat session:', err.message);
  }
}
