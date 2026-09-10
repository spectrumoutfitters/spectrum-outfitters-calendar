/**
 * Booking slot/horizon/buffer clamps used when resolving stored settings.
 * Extracted from customerBookingService.getResolvedBookingConfig — keep behavior identical.
 * `parseInt || fallback` means 0/NaN become the fallback (slot 30, horizon 21, buffer 0).
 * Distinct from frontend `??` hydrate clamps (0 is kept, then min-clamped).
 */

export function clampBookingSlotMinutesFromSetting(raw) {
  return Math.min(480, Math.max(15, parseInt(raw, 10) || 30));
}

export function clampBookingHorizonDaysFromSetting(raw) {
  return Math.min(60, Math.max(1, parseInt(raw, 10) || 21));
}

export function clampBookingBufferMinutesFromSetting(raw) {
  return Math.min(120, Math.max(0, parseInt(raw, 10) || 0));
}
