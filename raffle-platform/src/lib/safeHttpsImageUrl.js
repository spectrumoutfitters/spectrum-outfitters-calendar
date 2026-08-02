/**
 * Pure URL guard mirroring Apps Script isSafeHttpsImageUrl_.
 * Kept in sync with raffle-platform/google-apps-script/Code.gs.
 *
 * Allows empty (optional field), https:// absolute URLs, and same-origin
 * /raffle-images/... uploads. Rejects http, protocol-relative, and other schemes.
 */

export function isSafeHttpsImageUrl(url) {
  const u = String(url || '').trim();
  if (!u) return true;
  if (u.length > 2048) return false;
  const lower = u.toLowerCase();
  if (lower.indexOf('https://') === 0) return true;
  /* Same-origin uploads from raffle admin: /raffle-images/slug/file.jpg */
  if (lower.indexOf('/') === 0 && lower.indexOf('//') !== 0 && lower.indexOf('/raffle-images/') === 0) {
    return true;
  }
  return false;
}
