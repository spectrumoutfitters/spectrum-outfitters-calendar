/**
 * Match Payroll System pay-history rows to Calendar users / payroll people.
 * History shape varies: employee.id, employeeId, employee.name, employeeName, etc.
 */

function normalizeName(n) {
  return (n || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[,.'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s) {
  return normalizeName(s)
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * True if full_name in Calendar likely refers to the same person as name on pay stub.
 */
export function namesLikelyMatch(calendarFullName, payrollDisplayName) {
  const a = normalizeName(calendarFullName);
  const b = normalizeName(payrollDisplayName);
  if (!a || !b) return false;
  if (a === b) return true;

  const ta = tokenize(calendarFullName);
  const tb = tokenize(payrollDisplayName);
  if (ta.length === 0 || tb.length === 0) return false;

  // "lastname, firstname" on payroll → tokens might be [lastname, firstname]
  if (b.includes(',') || payrollDisplayName.includes(',')) {
    const parts = payrollDisplayName.split(',').map((p) => normalizeName(p)).filter(Boolean);
    if (parts.length >= 2) {
      const reversed = `${parts[parts.length - 1]} ${parts[0]}`.replace(/\s+/g, ' ');
      if (normalizeName(reversed) === a || namesLikelyMatch(calendarFullName, reversed)) return true;
    }
  }

  // First + last name must both appear (handles "Patrick Tung Gaines" vs "Patrick Gaines")
  if (ta.length >= 2) {
    const first = ta[0];
    const last = ta[ta.length - 1];
    if (first.length >= 2 && last.length >= 2 && tb.includes(first) && tb.includes(last)) return true;
  }

  // All "significant" tokens from the shorter list appear in the longer (min 3 chars to skip initials noise)
  const sig = (arr) => arr.filter((t) => t.length >= 3);
  const sa = sig(ta);
  const sb = sig(tb);
  const [shorter, longer] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
  if (shorter.length >= 2 && shorter.every((t) => longer.includes(t))) return true;

  // One normalized string contains the other (avoid tiny strings)
  if (a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a))) return true;

  return false;
}

function recordEmployeeIds(rec) {
  const e = rec.employee || {};
  const ids = [
    e.id,
    e.userId,
    e.user_id,
    e.calendarUserId,
    e.calendar_user_id,
    rec.employeeId,
    rec.employee_id,
    rec.userId,
    rec.user_id,
    rec.calendarUserId,
    rec.calendar_user_id,
  ];
  return ids.filter((v) => v != null && v !== '').map((v) => String(v));
}

/**
 * @param {object} rec - one payroll-history row
 * @param {{ source_type: string, source_id: number, name: string, username?: string }} src
 */
export function payrollHistoryRecordMatchesSource(rec, src) {
  const emp = rec.employee || {};
  const displayName =
    emp.name ||
    emp.fullName ||
    emp.full_name ||
    rec.employeeName ||
    rec.employee_name ||
    rec.name ||
    rec.payeeName ||
    rec.payee_name ||
    '';

  if (src.source_type === 'user') {
    const want = String(src.source_id);
    for (const id of recordEmployeeIds(rec)) {
      if (id === want) return true;
    }
    if (namesLikelyMatch(src.name, displayName)) return true;
    if (src.username && namesLikelyMatch(src.username, displayName)) return true;
    return false;
  }

  // payroll_person — name only
  return namesLikelyMatch(src.name, displayName);
}
