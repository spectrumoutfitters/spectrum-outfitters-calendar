/**
 * Google Calendar settings: accept OAuth-complete postMessage only from
 * this page origin or the local/backend :5000 hosts.
 * Distinct from server OAuth callback origin allowlists (#68/#119).
 */

export function googleCalendarOAuthPopupOrigins({ pageOrigin, hostname }) {
  const host = typeof hostname === 'string' ? hostname : 'localhost';
  return new Set([
    pageOrigin,
    `http://${host}:5000`,
    `https://${host}:5000`,
    'http://localhost:5000',
    'https://localhost:5000',
    'http://127.0.0.1:5000',
    'https://127.0.0.1:5000',
  ]);
}

export function isGoogleCalendarOAuthPopupMessage(event, origins) {
  if (!event?.data || event.data.type !== 'spectrum_google_calendar_connected') return false;
  if (!origins || !origins.has(event.origin)) return false;
  return true;
}

export function googleCalendarIdSaveError(calendarIdInput) {
  const trimmed = (calendarIdInput || '').trim();
  if (!trimmed) return 'Calendar ID cannot be empty.';
  return null;
}
