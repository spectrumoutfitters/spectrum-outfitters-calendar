/**
 * Pure helpers for employee shop-financing payee / money rules.
 * Kept free of Express/DB so unit tests need no sqlite.
 */

export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function validateDeductionReason(deductFromPayroll, reason) {
  if (!deductFromPayroll) return true;
  return typeof reason === 'string' && reason.trim().length > 0;
}

/** Either a Spectrum user id OR external person / other business — not both. */
export function parsePayee(body) {
  const extName = (body.external_party_name || '').trim();
  const extCo = (body.external_party_company || '').trim();
  const rawUid = body.user_id;
  const uid =
    rawUid === null || rawUid === undefined || rawUid === ''
      ? NaN
      : parseInt(String(rawUid), 10);
  if (!Number.isNaN(uid) && uid > 0) {
    return {
      kind: 'employee',
      user_id: uid,
      external_party_name: null,
      external_party_company: null
    };
  }
  if (extName.length > 0) {
    return {
      kind: 'external',
      user_id: null,
      external_party_name: extName,
      external_party_company: extCo || null
    };
  }
  return { kind: 'invalid' };
}

export function enrichFinancingRow(r) {
  if (!r) return r;
  if (r.user_id != null) {
    r.payer_display = r.employee_name || r.employee_username || `User #${r.user_id}`;
  } else {
    const co =
      r.external_party_company && String(r.external_party_company).trim()
        ? ` (${String(r.external_party_company).trim()})`
        : '';
    r.payer_display = (r.external_party_name || 'External payer') + co;
  }
  return r;
}
