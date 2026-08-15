/**
 * Pure helpers for POST /api/notifications/quick field checks, admin gate,
 * and message/payload construction. Extracted from routes/notifications.js —
 * keep behavior identical.
 */

/**
 * Type-specific required fields. Unknown types (including customer_arrived)
 * skip field validation. Checked before the admin gate in the route.
 */
export function validateQuickNotificationFields({ type, taskId, taskTitle, distributor, urgency }) {
  if (type === 'parts_arrived') {
    if (!taskTitle && !taskId) {
      return { error: 'Missing required field: taskTitle or taskId' };
    }
    if (!distributor) {
      return { error: 'Missing required field: distributor' };
    }
  } else if (type === 'need_assistance') {
    if (!urgency) {
      return { error: 'Missing required field: urgency' };
    }
  }
  return { ok: true };
}

/** Only the exact string `'admin'` is blocked; other roles (including `'Admin'`) may send. */
export function canSendQuickNotification(role) {
  return role !== 'admin';
}

export function buildQuickNotificationMessage({
  type,
  userName,
  vehicle,
  taskTitle,
  distributor,
  urgency,
}) {
  if (type === 'parts_arrived') {
    const vehicleInfo = vehicle || taskTitle || 'Unknown Vehicle';
    return `📦 Parts Arrived: ${userName} reports that parts have arrived for ${vehicleInfo} from ${distributor}.`;
  }
  if (type === 'need_assistance') {
    const urg = urgency || 'convenience';
    const urgencyText = urg === 'immediate' ? '🚨 IMMEDIATE' : '⏰ At First Convenience';
    return `${urgencyText} Assistance Needed: ${userName} needs assistance (${urg === 'immediate' ? 'urgent' : 'when convenient'}).`;
  }
  if (type === 'customer_arrived') {
    return `👋 Customer Arrived: ${userName} reports that a customer has arrived at the shop.`;
  }
  return `🔔 Quick Notification: ${userName} sent a notification.`;
}

/** Mutates and returns the socket payload with type-specific fields. */
export function applyQuickNotificationTypeFields(notificationData, {
  type,
  taskId,
  taskTitle,
  distributor,
  urgency,
}) {
  if (type === 'parts_arrived') {
    if (taskId) {
      notificationData.taskId = taskId;
    }
    notificationData.taskTitle = taskTitle || 'Unknown Task';
    notificationData.distributor = distributor;
  } else if (type === 'need_assistance') {
    notificationData.urgency = urgency;
  }
  return notificationData;
}
