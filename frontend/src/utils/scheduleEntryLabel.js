/**
 * Employee schedule chip text, time-off type labels, and street-view address.
 * Shop-closed wins over status. Address prefers the location column, then "Location:" in notes.
 */

const TYPE_LABELS = {
  day_off: 'Day Off',
  time_off_request: 'Time Off Request',
  approved_time_off: 'Approved Time Off',
  out_of_office: 'Out of Office',
  vacation: 'Vacation',
  sick_leave: 'Sick Leave',
  personal_leave: 'Personal Leave',
  training: 'Training',
  meeting: 'Meeting',
  other: 'Other',
  appointment: 'Appointment',
  workshop: 'Workshop',
  conference: 'Conference',
};

export function scheduleTypeLabel(type) {
  return TYPE_LABELS[type] || type;
}

export function scheduleEntryLabel(entry) {
  if (entry.is_shop_wide) return 'Shop Closed';
  if (entry.status === 'pending') return `Pending ${scheduleTypeLabel(entry.type)}`;
  if (entry.status === 'approved') return scheduleTypeLabel(entry.type);
  if (entry.status === 'rejected') return 'Rejected';
  return entry.reason || scheduleTypeLabel(entry.type);
}

export function looksLikeScheduleAddress(text) {
  const t = (text || '').trim();
  return t.length >= 8 && /\d/.test(t);
}

export function scheduleEventAddress(entry) {
  if (entry?.location && typeof entry.location === 'string') {
    const t = entry.location.trim();
    if (t) return t;
  }
  const notes = entry?.notes;
  if (typeof notes !== 'string') return null;
  const match = notes.match(/Location:\s*(.+?)(?:\n|$)/);
  return match ? match[1].trim() : null;
}
