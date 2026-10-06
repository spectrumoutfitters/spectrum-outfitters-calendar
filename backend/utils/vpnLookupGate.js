/**
 * getipintel.net lookup is skipped unless a contact email is set,
 * and never runs for loopback or unknown client IPs.
 * `contact` is the raw GETIPINTEL_CONTACT value (trimmed here).
 */
export function shouldSkipVpnLookup(ip, contact) {
  const trimmed = typeof contact === 'string' ? contact.trim() : '';
  if (!trimmed || !ip || ip === '127.0.0.1' || ip === '::1' || ip === 'unknown') {
    return true;
  }
  return false;
}
