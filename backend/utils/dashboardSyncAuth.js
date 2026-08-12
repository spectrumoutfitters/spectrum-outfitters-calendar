import crypto from 'crypto';

/**
 * Shared-secret auth for Dashboard Assistant sync.
 * Accepts token from Authorization Bearer, X-Dashboard-Sync-Token, or ?token=.
 * Timing-safe compare against DASHBOARD_SYNC_TOKEN.
 */
export function extractDashboardSyncToken(req) {
  const header = String(req.headers?.authorization || '');
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const headerToken = String(req.headers?.['x-dashboard-sync-token'] || '').trim();
  const queryToken = String(req.query?.token || '').trim();
  return bearer || headerToken || queryToken || '';
}

export function dashboardSyncTokenConfigured() {
  return Boolean(String(process.env.DASHBOARD_SYNC_TOKEN || '').trim());
}

export function dashboardSyncTokenMatches(provided) {
  const expected = String(process.env.DASHBOARD_SYNC_TOKEN || '').trim();
  const got = String(provided || '').trim();
  if (!expected || !got) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(got, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
