/**
 * Shop-financing UI helpers: week-ending Friday default, payroll deduction
 * suggestion, and form payee/user filters.
 */

/** Coming Friday in local time, including today when today is Friday. */
export function upcomingFridayLocal(date = new Date()) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  const day = d.getDay();
  const add = (5 - day + 7) % 7;
  const fri = new Date(d);
  fri.setDate(d.getDate() + add);
  const y = fri.getFullYear();
  const m = String(fri.getMonth() + 1).padStart(2, '0');
  const dd = String(fri.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Prefill amount: min(weekly, balance). Only 0/NaN/'' hit || 0; nonzero negatives stay. */
export function suggestedPayrollDeduction(plan) {
  return Math.min(Number(plan?.weekly_payment) || 0, Number(plan?.balance_due) || 0);
}

export function suggestedDeductionAmountInput(plan) {
  const suggested = suggestedPayrollDeduction(plan);
  return suggested > 0 ? String(suggested) : '';
}

/** Assignable employee list: only exact 1 or boolean true. */
export function isActiveAssignableUser(user) {
  return user?.is_active === 1 || user?.is_active === true;
}

/** Edit-form payee: any non-null, non-empty user_id is treated as employee (0 counts). */
export function isEmployeePayee(plan) {
  return plan?.user_id != null && plan?.user_id !== '';
}
