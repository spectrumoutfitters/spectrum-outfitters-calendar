/**
 * Canonical US raffle phone: digits only, strip a leading country-code 1
 * when the value is 11 digits (e.g. +1 (555) 123-4567 → 5551234567).
 *
 * Keep in sync with normalizePhone_ in raffle-platform/google-apps-script/Code.gs.
 */
export function canonicalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.charAt(0) === '1') return digits.slice(1);
  return digits;
}

/** True when both values are the same 10+ digit raffle identity after canonicalization. */
export function phonesEquivalent(a, b) {
  const left = canonicalizePhone(a);
  const right = canonicalizePhone(b);
  return left.length >= 10 && left === right;
}
