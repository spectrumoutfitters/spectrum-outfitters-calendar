/** Unread badge + auto-show throttle for UpdatesBadge. Distinct from changelog parse. */

const AUTO_SHOW_MS = 60 * 60 * 1000;

export function formatUnreadBadgeCount(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return '';
  return n > 9 ? '9+' : String(Math.floor(n));
}

export function shouldAutoShowUpdates({ unreadCount, lastShownAt, now = Date.now() } = {}) {
  const n = Number(unreadCount);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (!lastShownAt) return true;
  const last = parseInt(lastShownAt, 10);
  return now - last > AUTO_SHOW_MS;
}
