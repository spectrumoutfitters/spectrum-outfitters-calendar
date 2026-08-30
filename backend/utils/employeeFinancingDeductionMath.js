/**
 * Record-deduction math for employee shop financing.
 * Distinct from create/update payee XOR + deduction-reason gating (#66):
 * this path clamps the payment to remaining balance, composes the payroll
 * reason note, and flips status to paid_off at zero.
 * Kept free of Express/DB so unit tests need no sqlite.
 */

export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function parseDeductionWeek(weekEndingDate) {
  const week = (weekEndingDate || '').trim();
  if (!week) {
    return { ok: false, error: 'week_ending_date is required (e.g. pay week ending Friday)' };
  }
  return { ok: true, week };
}

/** Only active plans with a positive rounded balance can receive a deduction. */
export function financingDeductionPlanGate(plan) {
  if (!plan) return { ok: false, status: 404, error: 'Plan not found' };
  if (plan.status !== 'active') {
    return { ok: false, status: 400, error: 'Only active plans can receive deductions' };
  }
  const bal = roundMoney(plan.balance_due);
  if (bal <= 0) return { ok: false, status: 400, error: 'Balance is already zero' };
  return { ok: true, bal };
}

/**
 * amount != null uses the posted amount (so '' / 0 become 0 and fail);
 * null/undefined fall back to weeklyPayment. Payment is clamped to balance.
 */
export function computeFinancingDeduction({
  amount,
  weeklyPayment,
  balance,
  deductionReason,
  extraNote,
} = {}) {
  let payAmount = amount != null ? roundMoney(amount) : roundMoney(weeklyPayment);
  if (payAmount <= 0) {
    return { ok: false, error: 'Amount must be greater than 0' };
  }
  payAmount = Math.min(payAmount, balance);

  const baseReason = (deductionReason || '').trim() || 'Shop financing repayment';
  const extra = (extraNote || '').trim();
  const reasonNote = extra ? `${baseReason} — ${extra}` : baseReason;

  const newBal = roundMoney(balance - payAmount);
  const newStatus = newBal <= 0 ? 'paid_off' : 'active';
  return { ok: true, payAmount, reasonNote, newBal, newStatus };
}
