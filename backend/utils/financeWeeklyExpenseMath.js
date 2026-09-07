/**
 * Weekly cash-flow expense buckets used by GET /finance/cash-flow and forecast.
 *
 * Locks existing coercion — do not "fix":
 * - Calendar users: truthy `weekly_salary && weekly_salary > 0` (string compare),
 *   then raw `parseFloat` with no `|| 0` (NaN can poison the payroll sum).
 * - Else hourly: `hourly_rate && hourly_rate > 0`, hours * raw `parseFloat(rate)`.
 * - Open break_minutes uses `|| 0` (NaN / '' / null / 0 all become 0).
 * - payroll_people: `parseFloat || 0`, skip `cost <= 0`, skip names already in
 *   the weekly-salary user set, skip duplicate `${norm}|${cost}`.
 * - Manual monthly amounts divide by 4.33 (weeks/month). Distinct from #84
 *   reimbursement owed, which uses the same 4.33 on *expected* pay, not expenses.
 */

import { normalizePayrollDisplayName } from './payrollDedupe.js';

export const MONTHLY_WEEKS = 4.33;

/** Truthy weekly_salary AND `> 0` (JS string compare). `'0'` / `'abc'` are hourly. */
export function usesWeeklySalary(emp) {
  return !!(emp?.weekly_salary && emp.weekly_salary > 0);
}

/** Only reached when weekly salary is not used. Same truthy-and-`> 0` gate. */
export function usesHourlyRate(emp) {
  return !!(emp?.hourly_rate && emp.hourly_rate > 0);
}

/** Raw parseFloat — no `|| 0`. Callers already gated `weekly_salary > 0`. */
export function weeklySalaryCost(salary) {
  return parseFloat(salary);
}

/**
 * Hours for one closed shift: max(0, elapsed hours − break hours).
 * `break_minutes || 0` — NaN / '' / null / 0 all become 0 (NaN is falsy).
 */
export function shiftHoursFromEntry(entry) {
  return Math.max(
    0,
    (new Date(entry.clock_out) - new Date(entry.clock_in)) / 3600000
      - (entry.break_minutes || 0) / 60,
  );
}

/** hours * raw parseFloat(rate) — no `|| 0` on the rate. */
export function hourlyPayrollCost(hours, hourlyRate) {
  return hours * parseFloat(hourlyRate);
}

/** `parseFloat(amount) || 0`, optional divisor (monthly uses MONTHLY_WEEKS). */
export function sumExpenseAmounts(rows, divisor = 1) {
  let total = 0;
  for (const e of rows || []) total += (parseFloat(e.amount) || 0) / divisor;
  return total;
}

/**
 * Add contractor weekly salaries, skipping calendar-user name collisions
 * and duplicate name+cost rows. Mutates nothing; returns new total.
 */
export function addPayrollPeopleWeeklyCosts(payrollTotal, people, userWeeklyNames) {
  const seenPpWeekly = new Set();
  let total = payrollTotal;
  for (const p of people || []) {
    const cost = parseFloat(p.weekly_salary) || 0;
    if (cost <= 0) continue;
    const norm = normalizePayrollDisplayName(p.full_name);
    if (userWeeklyNames.has(norm)) continue;
    const key = `${norm}|${cost}`;
    if (seenPpWeekly.has(key)) continue;
    seenPpWeekly.add(key);
    total += cost;
  }
  return total;
}

/** `parseFloat(bank?.total || 0)` — missing bank row → 0. */
export function bankExpenseTotal(bank) {
  return parseFloat(bank?.total || 0);
}

export function combineWeeklyExpenseTotals({ payroll, manual, bank }) {
  return { payroll, manual, bank, total: payroll + manual + bank };
}
