/**
 * Pure public booking form gates (name / phone digits / slot / enabled).
 * Extracted from pages/CustomerBooking.jsx — keep behavior identical.
 */

export function customerBookingFormError({ customerName = '', customerPhone = '', slotStartIso, config } = {}) {
  if (!customerName.trim() || customerName.trim().length < 2) return 'Please enter your full name.';
  const digits = customerPhone.replace(/\D/g, '');
  if (digits.length < 7) return 'Please enter a valid phone number.';
  if (!slotStartIso) return 'Pick a drop-off time.';
  if (!config?.enabled) return 'Booking is not available.';
  return null;
}
