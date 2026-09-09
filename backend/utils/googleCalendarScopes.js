/**
 * Pure Google Calendar / Gmail consent + schedule-sync predicates.
 * Extracted from googleCalendarService.js — keep behavior identical.
 * Do not import googleCalendarService.js from tests (googleapis/db side effects).
 */

export function hasGmailSendScope(oauthScopes) {
  const s = (oauthScopes || '').toLowerCase();
  return (
    s.includes('gmail.send') ||
    s.includes('auth/gmail.send') ||
    s.includes('https://www.googleapis.com/auth/gmail.send')
  );
}

/** Scopes sufficient to learn the Gmail "From" address (UserInfo API or Gmail getProfile). */
export function hasSenderIdentityScope(oauthScopes) {
  const s = (oauthScopes || '').toLowerCase();
  return (
    s.includes('userinfo.email') ||
    s.includes('/auth/userinfo.email') ||
    s.includes('gmail.readonly') ||
    s.includes('gmail.metadata') ||
    s.includes('gmail.modify') ||
    s.includes('gmail.compose') ||
    s.includes('https://mail.google.com/')
  );
}

/** Calendar + Gmail send + ability to resolve the connected account email (booking notifications From:). */
export function hasBookingOutboundMailScopes(oauthScopes) {
  return hasGmailSendScope(oauthScopes) && hasSenderIdentityScope(oauthScopes);
}

export function shouldSyncEntryToGoogle(entry) {
  if (!entry) return false;
  if (entry.status === 'pending') return false;
  if (entry.type === 'time_off_request') return false;
  return true;
}
