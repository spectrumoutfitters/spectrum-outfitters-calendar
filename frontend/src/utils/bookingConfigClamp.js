/**
 * Booking settings hydrate clamps (slot / horizon / buffer).
 * Extracted from BookingSettings.jsx — keep `??` then min/max behavior identical.
 * `0` is kept (then raised to the min), unlike backend parseInt|| fallback (0 → default).
 */

export function clampBookingSlotMinutesFromConfig(slotMinutes) {
  return Math.min(480, Math.max(15, slotMinutes ?? 30));
}

export function clampBookingHorizonDaysFromConfig(horizonDays) {
  return Math.min(60, Math.max(1, horizonDays ?? 21));
}

export function clampBookingBufferMinutesFromConfig(bufferMinutes) {
  return Math.min(120, Math.max(0, bufferMinutes ?? 0));
}
