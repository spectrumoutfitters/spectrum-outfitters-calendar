/** Employee quick-notify button. Admins are rejected by the API, so hide it for them. */
export function shouldShowQuickNotifications({ user, isAdmin } = {}) {
  if (isAdmin || !user) return false;
  return true;
}
