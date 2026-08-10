/**
 * Profit & Loss UI helpers: local Friday week-ending snap and net-of-reimbursement display.
 * Intentionally uses local Date semantics (same as ProfitAndLoss.jsx historically).
 */

/**
 * Snap a date to the business week-ending Friday and return YYYY-MM-DD via toISOString.
 * @param {string|Date} dateInput
 * @returns {string}
 */
export function snapToWeekEndingFriday(dateInput) {
  const selectedDate = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput);
  if (Number.isNaN(selectedDate.getTime())) return '';
  const day = selectedDate.getDay(); // 0 = Sunday, 5 = Friday
  if (day === 5) {
    return selectedDate.toISOString().split('T')[0];
  }
  if (day < 5) {
    selectedDate.setDate(selectedDate.getDate() + (5 - day));
    return selectedDate.toISOString().split('T')[0];
  }
  selectedDate.setDate(selectedDate.getDate() - (day - 5));
  return selectedDate.toISOString().split('T')[0];
}

/**
 * Toggle "net of expected reimbursement" display transforms used by the P&L summary cards.
 * @param {{
 *   showNetOfReimbursement: boolean,
 *   payrollTotal?: number,
 *   expectedReimb?: number,
 *   summaryTotalExpenses?: number,
 *   summaryNetProfitLoss?: number,
 *   totalRevenue?: number,
 * }} opts
 */
export function pnlNetOfReimbursementDisplay({
  showNetOfReimbursement,
  payrollTotal = 0,
  expectedReimb = 0,
  summaryTotalExpenses = 0,
  summaryNetProfitLoss = 0,
  totalRevenue = 0,
}) {
  const reimb = Number(expectedReimb) || 0;
  const displayPayrollTotal = showNetOfReimbursement
    ? (Number(payrollTotal) || 0) - reimb
    : Number(payrollTotal) || 0;
  const displayTotalExpenses = showNetOfReimbursement
    ? (Number(summaryTotalExpenses) || 0) - reimb
    : Number(summaryTotalExpenses) || 0;
  const displayNetProfitLoss = showNetOfReimbursement
    ? (Number(summaryNetProfitLoss) || 0) + reimb
    : Number(summaryNetProfitLoss) || 0;
  const rev = Number(totalRevenue) || 0;
  const displayProfitMargin = rev > 0 ? (displayNetProfitLoss / rev) * 100 : 0;
  const displayIsProfitable = displayNetProfitLoss > 0;
  return {
    displayPayrollTotal,
    displayTotalExpenses,
    displayNetProfitLoss,
    displayProfitMargin,
    displayIsProfitable,
  };
}
