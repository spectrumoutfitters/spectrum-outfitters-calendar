/**
 * Pure helpers for payroll access, data-file path safety, Calendar→payroll
 * employee merge, Mon–Sun week windows, and hours/history totals.
 * Extracted from routes/payroll.js — keep behavior identical.
 */

export function payrollAccessFlags(user) {
  const hasAccess = user.payroll_access === 1 || user.is_master_admin === 1;
  const isMasterAdmin = user.is_master_admin === 1;
  return {
    hasAccess,
    isMasterAdmin,
    payrollAccess: user.payroll_access === 1,
    isMaster: user.is_master_admin === 1,
  };
}

/**
 * Blocks revoking payroll access from a master admin or from yourself.
 * `payroll_access === false` is required (0 / "false" do not trip the guard).
 */
export function payrollAccessRevokeBlock({ targetIsMasterAdmin, actorId, targetId, payroll_access }) {
  if (targetIsMasterAdmin && payroll_access === false) {
    return { blocked: true, error: 'Cannot remove payroll access from master admin' };
  }
  if (parseInt(targetId) === actorId && payroll_access === false) {
    return { blocked: true, error: 'Cannot remove your own payroll access' };
  }
  return { blocked: false };
}

export function isSafePayrollDataFilename(filename) {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }
  return true;
}

export function payrollEmployeeLookupKey(emp) {
  return emp.name?.toLowerCase() || emp.username?.toLowerCase() || '';
}

export function calendarEmployeeLookupKey(calEmp) {
  return calEmp.full_name?.toLowerCase() || calEmp.username?.toLowerCase() || '';
}

export function mergeCalendarPayrollEmployee(calEmp, existingPayroll) {
  return {
    id: calEmp.id,
    name: calEmp.full_name,
    username: calEmp.username,
    email: calEmp.email || '',
    hourlyRate: calEmp.hourly_rate || existingPayroll?.hourlyRate || 0,
    weeklySalary: calEmp.weekly_salary || existingPayroll?.weeklySalary || 0,
    ...(existingPayroll && {
      taxInfo: existingPayroll.taxInfo,
      deductions: existingPayroll.deductions,
      notes: existingPayroll.notes,
    }),
  };
}

/** Monday 00:00:00.000 through the parsed week's Sunday 23:59:59.999 (local TZ of the Date). */
export function payrollWeekBoundsFromEndingDate(week_ending_date) {
  const weekEnd = new Date(week_ending_date);
  const dayOfWeek = weekEnd.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - daysToSubtract);
  weekStart.setHours(0, 0, 0, 0);

  const weekEndDate = new Date(weekEnd);
  weekEndDate.setHours(23, 59, 59, 999);
  return { weekStart, weekEndDate };
}

export function mapPayrollTimeEntry(entry) {
  const clockIn = new Date(entry.clock_in);
  const clockOut = new Date(entry.clock_out);
  const hours = (clockOut - clockIn) / (1000 * 60 * 60) - (entry.break_minutes || 0) / 60;

  return {
    user_id: entry.user_id,
    full_name: entry.full_name,
    username: entry.username,
    date: entry.clock_in.split('T')[0],
    clock_in: entry.clock_in,
    clock_out: entry.clock_out,
    hours: Math.max(0, hours),
    break_minutes: entry.break_minutes || 0,
    hourly_rate: entry.hourly_rate || 0,
    weekly_salary: entry.weekly_salary || 0,
  };
}

export function groupPayrollTimeByUser(timeData) {
  return timeData.reduce((acc, entry) => {
    if (!acc[entry.user_id]) {
      acc[entry.user_id] = {
        user_id: entry.user_id,
        full_name: entry.full_name,
        username: entry.username,
        hourly_rate: entry.hourly_rate,
        weekly_salary: entry.weekly_salary,
        total_hours: 0,
        entries: [],
      };
    }
    acc[entry.user_id].total_hours += entry.hours;
    acc[entry.user_id].entries.push(entry);
    return acc;
  }, {});
}

export function payrollHistoryInDateRange(records, start_date, end_date) {
  if (!start_date && !end_date) return records;
  return records.filter((record) => {
    const recordDate = record.payDate || record.date || record.processedDate || '';
    if (start_date && recordDate < start_date) return false;
    if (end_date && recordDate > end_date) return false;
    return true;
  });
}

export function sumPayrollHistoryTotals(records) {
  return records.reduce(
    (acc, record) => {
      acc.total_gross += parseFloat(record.grossPay || 0);
      acc.total_taxes += parseFloat(record.totalTaxes || 0);
      acc.total_net += parseFloat(record.netPay || 0);
      acc.record_count += 1;
      return acc;
    },
    { total_gross: 0, total_taxes: 0, total_net: 0, record_count: 0 }
  );
}
