/**
 * Per-person reimbursement tracker on the P&L page.
 * Prefers server-computed totals. When those fields are absent, weekly sources
 * accrue expected_amount × pay runs; monthly sources stay at zero so a missing
 * server accrual is not multiplied once per paycheck.
 */

const HINT_FROM_DATABASE =
  'Sum of pays from stored payroll history (Calendar database; file on disk is optional).';
const HINT_FROM_HISTORY = 'Sum of pays in payroll history';
const HINT_NO_HISTORY =
  'No pay history on the server yet. Use Import pay history (JSON) with payroll-history.json from the Payroll app PC.';
const HINT_NO_MATCH =
  'No pays matched this person — align Calendar user ID or full name with the Payroll System export.';

/**
 * @param {{
 *   source_type?: string,
 *   source_id?: string|number,
 *   expected_period?: string,
 *   expected_amount?: number|string,
 *   pay_records?: Array<{ amount?: number }>,
 *   total_paid_from_payroll?: number|null,
 *   amount_owed_estimate?: number|null,
 *   cumulative_expected_from_other?: number|null,
 * }} src
 * @param {{
 *   totalReceivedBySource?: Record<string, number>,
 *   payrollHistoryRowCount?: number,
 *   payrollHistoryDbCount?: number,
 * }} [context]
 */
export function reimbursementTrackerFigures(src, context = {}) {
  const source = src || {};
  const {
    totalReceivedBySource,
    payrollHistoryRowCount = 0,
    payrollHistoryDbCount = 0,
  } = context;
  const key = `${source.source_type}:${source.source_id}`;
  const totalReceived = totalReceivedBySource[key] || 0;
  const rhRows = payrollHistoryRowCount ?? 0;
  const rhDb = payrollHistoryDbCount ?? 0;
  const isMonthly = source.expected_period === 'monthly';
  const payRecords = source.pay_records || [];
  const totalPaid = source.total_paid_from_payroll != null
    ? source.total_paid_from_payroll
    : payRecords.reduce((sum, record) => sum + (record.amount || 0), 0);
  const amountOwed = source.amount_owed_estimate != null ? source.amount_owed_estimate : 0;
  const payRunCount = payRecords.length;
  const accruedShare = source.cumulative_expected_from_other != null
    ? source.cumulative_expected_from_other
    : (isMonthly ? 0 : payRunCount * (parseFloat(source.expected_amount) || 0));
  const balance = accruedShare - totalReceived;
  const payrollPaidHint = totalPaid > 0
    ? (rhDb > 0 ? HINT_FROM_DATABASE : HINT_FROM_HISTORY)
    : (rhRows === 0 ? HINT_NO_HISTORY : HINT_NO_MATCH);

  return {
    key,
    totalReceived,
    isMonthly,
    totalPaid,
    amountOwed,
    payRunCount,
    accruedShare,
    balance,
    payrollPaidHint,
  };
}
