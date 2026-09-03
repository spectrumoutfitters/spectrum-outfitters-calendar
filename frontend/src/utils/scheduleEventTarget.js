/**
 * Admin schedule "add event" target: gcal:* vs user:* vs raw id.
 * Non-admins and falsy target_user_id leave the payload unchanged.
 */

export function applyScheduleEventTarget(payload, { isAdmin, targetUserId, adminUserId } = {}) {
  if (!isAdmin || !targetUserId) return payload;
  if (targetUserId.startsWith('gcal:')) {
    payload.google_calendar_id = targetUserId.slice(5);
    payload.user_id = adminUserId;
  } else {
    const uid = targetUserId.replace(/^user:/, '');
    if (uid) payload.user_id = Number(uid);
  }
  return payload;
}
