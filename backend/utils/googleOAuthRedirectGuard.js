/**
 * Pure Google OAuth redirect-URI resolution and production safety checks.
 * Extracted from googleCalendarService.js so connect-flow guards can be tested
 * without opening SQLite / googleapis.
 */

export function getGoogleOAuthRedirectUri(env = process.env) {
  const port = env.PORT || 5000;
  // Without GOOGLE_REDIRECT_URI, OAuth sends the USER'S BROWSER to this URL after Google.
  // On a VPS (DigitalOcean, etc.) set GOOGLE_REDIRECT_URI to https://your-domain/.../callback
  // or every user hits localhost on their own machine (connection refused).
  return (env.GOOGLE_REDIRECT_URI || '').trim() || `http://localhost:${port}/api/google-calendar/callback`;
}

/**
 * Fail fast when production would send OAuth callbacks to localhost.
 * @returns {{ ok: true } | { ok: false, error: Error } | { ok: true, warning: string }}
 */
export function checkGoogleOAuthRedirectUri(env = process.env) {
  if (env.SKIP_OAUTH_REDIRECT_CHECK === '1') {
    return { ok: true };
  }
  const explicit = (env.GOOGLE_REDIRECT_URI || '').trim();
  if (!explicit && env.NODE_ENV === 'production') {
    return {
      ok: false,
      error: new Error(
        'Google OAuth is not configured for production: set GOOGLE_REDIRECT_URI in backend/.env on the server to your public HTTPS callback URL, for example:\n' +
          '  GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN.com/api/google-calendar/callback\n\n' +
          'Add the exact same URL under Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client → Authorized redirect URIs.\n' +
          'Without this, Google sends users to localhost on their own computer, not to your DigitalOcean server.'
      ),
    };
  }
  if (explicit && env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/i.test(explicit)) {
    return {
      ok: true,
      warning:
        '[Google OAuth] GOOGLE_REDIRECT_URI points to localhost while NODE_ENV=production. ' +
        'After sign-in, browsers will not reach your VPS. Use https://your-public-domain/.../api/google-calendar/callback',
    };
  }
  return { ok: true };
}

export function assertRedirectUriOkForConnect(env = process.env, log = console) {
  const result = checkGoogleOAuthRedirectUri(env);
  if (!result.ok) {
    throw result.error;
  }
  if (result.warning) {
    log.warn(result.warning);
  }
}
