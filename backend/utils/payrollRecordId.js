/**
 * Stable row id for payroll_system_pay_history INSERT OR REPLACE.
 * Explicit id wins when non-null and non-whitespace (numeric 0 is kept as "0").
 * Otherwise synth:empId:processed:week with || fallbacks.
 */
export function stablePayrollRecordId(rec) {
  if (rec && rec.id != null && String(rec.id).trim() !== '') return String(rec.id);
  const e = rec.employee || {};
  const empId = e.id || rec.employeeId || rec.employee_id || '';
  const proc = rec.processedDate || rec.payDate || rec.date || '';
  const week = rec.weekStart || rec.weekEnd || '';
  return `synth:${empId}:${proc}:${week}`;
}
