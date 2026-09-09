/**
 * Pure public-booking submit field gates (name / phone / email / honeypot).
 * Extracted from customerBookingService.submitCustomerBooking — keep behavior identical.
 * Do not import customerBookingService.js from tests (luxon/db/Google side effects).
 */

export function coerceBookingCustomerName(raw) {
  return String(raw ?? '')
    .trim()
    .slice(0, 200);
}

export function coerceBookingCustomerPhone(raw) {
  return String(raw ?? '')
    .replace(/[^\d+()\-\s]/g, '')
    .trim()
    .slice(0, 40);
}

export function coerceBookingCustomerEmail(raw) {
  const emailPart = String(raw ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 200);
  return emailPart && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPart) ? emailPart : null;
}

export function bookingHoneypotTriggered(payload) {
  return Boolean(String(payload?.company_website ?? payload?.website ?? '').trim());
}

/** First field-level reject, or null when name/phone/honeypot pass. */
export function bookingSubmitFieldError(payload = {}) {
  const name = coerceBookingCustomerName(payload.customer_name);
  if (!name || name.length < 2) {
    return { code: 'validation', message: 'Please enter your name.' };
  }
  const phone = coerceBookingCustomerPhone(payload.customer_phone);
  if (!phone || phone.replace(/\D/g, '').length < 7) {
    return { code: 'validation', message: 'Please enter a valid phone number.' };
  }
  if (bookingHoneypotTriggered(payload)) {
    return { code: 'spam', message: 'Spam blocked.' };
  }
  return null;
}
