/**
 * Weekly split-pay-run amount pick. Extracted from payrollSplitRuns — keep behavior identical.
 * Do not import payrollSplitRuns.js from tests (sqlite / appTimezone side effects).
 */

export function toNumber(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Prefer weekly_salary when it parses > 0; otherwise split_reimbursable_amount. */
export function pickSplitPayRunAmount(row) {
  const weekly = toNumber(row?.weekly_salary);
  return weekly > 0 ? weekly : toNumber(row?.split_reimbursable_amount);
}
