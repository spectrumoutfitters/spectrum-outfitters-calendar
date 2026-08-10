/**
 * Reimbursement accrual estimates from expected amount × pay periods minus received.
 */

import { normalizePayRecordDate } from './payrollDedupe.js';

/**
 * @param {{ expected_amount?: number, expected_period?: string }} src
 * @param {Array<{ pay_date?: string }>} payRecords
 * @param {number} [totalReceived]
 */
export function recomputeReimbursementOwed(src, payRecords, totalReceived) {
  let amountOwedEstimate = 0;
  if (src?.expected_amount > 0 && payRecords?.length > 0) {
    const received = totalReceived || 0;
    if (src.expected_period === 'monthly') {
      const months = new Set(
        payRecords.map((r) => normalizePayRecordDate(r.pay_date).slice(0, 7)).filter(Boolean)
      );
      amountOwedEstimate = Math.max(0, months.size * src.expected_amount - received);
    } else {
      amountOwedEstimate = Math.max(0, payRecords.length * src.expected_amount - received);
    }
  }
  return amountOwedEstimate;
}

/**
 * Cumulative expected reimbursement from the "other" business before subtracting received.
 * @param {{ expected_amount?: number|string, expected_period?: string }} src
 * @param {Array<{ pay_date?: string }>|null|undefined} payRecords
 * @returns {number|null}
 */
export function cumulativeExpectedFromOther(src, payRecords) {
  const exp = parseFloat(src?.expected_amount) || 0;
  if (exp <= 0 || !payRecords?.length) return null;
  if (src.expected_period === 'monthly') {
    const months = new Set(
      payRecords.map((r) => normalizePayRecordDate(r.pay_date).slice(0, 7)).filter(Boolean)
    );
    return months.size * exp;
  }
  return payRecords.length * exp;
}
