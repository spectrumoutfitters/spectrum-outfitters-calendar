/**
 * Pure booking config clamps and calendar-id normalization.
 * Free of DB / Google imports so unit tests stay lightweight.
 */

/** Dedupe trimmed calendar IDs while preserving first-seen order. */
export function uniqCalendarIds(ids) {
  const out = [];
  const seen = new Set();
  for (const x of ids || []) {
    const id = typeof x === 'string' ? x.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Slot length minutes: default 30, floor 15, ceiling 480. */
export function clampBookingSlotMinutes(raw) {
  return Math.min(480, Math.max(15, parseInt(raw, 10) || 30));
}

/** Booking horizon days: default 21, floor 1, ceiling 60. */
export function clampBookingHorizonDays(raw) {
  return Math.min(60, Math.max(1, parseInt(raw, 10) || 21));
}

/** Buffer-before minutes: default 0, floor 0, ceiling 120. */
export function clampBookingBufferBeforeMinutes(raw) {
  return Math.min(120, Math.max(0, parseInt(raw, 10) || 0));
}
