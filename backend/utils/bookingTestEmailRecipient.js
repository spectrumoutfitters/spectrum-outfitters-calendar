/**
 * Resolve the destination for POST /admin/booking/test-email.
 * Body `to` is used only when it is a string that trims/lowercases to a
 * simple email. Otherwise the first notify_emails entry is used as-is
 * (not re-validated). Distinct from OAuth scope gates (#48) and outbound
 * header sanitizing (#81).
 */

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveBookingTestEmailTo(bodyTo, notifyEmails) {
  const candidate = typeof bodyTo === 'string' ? bodyTo.trim().toLowerCase() : '';
  if (candidate && SIMPLE_EMAIL.test(candidate)) {
    return { ok: true, to: candidate, source: 'body' };
  }
  if (notifyEmails?.length) {
    return { ok: true, to: notifyEmails[0], source: 'notify' };
  }
  return {
    ok: false,
    error: 'Add notify emails in booking settings, or send ?to=inbox@yourshop.com.',
  };
}
