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

  // Every "significant" calendar token (3+ chars) appears in payroll string — e.g. Calendar
  // "Patrick Tung Gaines" matches payroll export "Patrick Gaines" (patrick + gaines both in longer payroll name).
  const sigA = ta.filter((t) => t.length >= 3);
  if (sigA.length >= 2 && sigA.every((t) => b.includes(t))) return true;

  // Reciprocal: payroll's significant tokens all appear in calendar full name (short payroll label)
  const sigB = tb.filter((t) => t.length >= 3);
  if (sigB.length >= 2 && sigB.every((t) => a.includes(t))) return true;

  return false;
}

function recordEmployeeIds(rec) {
  const e = rec.employee || rec.paystub?.employee || {};
  const ids = [
    e.id,
    e.userId,
    e.user_id,
    e.calendarUserId,
    e.calendar_user_id,
    e.calendarId,
    e.linkedUserId,
    e.linked_user_id,
    e.spectrumUserId,
    e.spectrum_user_id,
    rec.employeeId,
    rec.employee_id,
    rec.userId,
    rec.user_id,
    rec.calendarUserId,
    rec.calendar_user_id,
    rec.selectedEmployee?.id,
    rec.selectedEmployee?.userId,
    rec.selectedEmployee?.calendarId,
  ];
  return ids.filter((v) => v != null && v !== '').map((v) => String(v));
}

/** Any string field on the employee object may carry a display / legal / nick name. */
function employeeStringNameBlob(emp) {
  if (!emp || typeof emp !== 'object') return '';
  const parts = [];
  for (const v of Object.values(emp)) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t && !/^\d+$/.test(t) && t.length < 200) parts.push(t);
    }
  }
  return parts.join(' ').trim();
}

/**
 * @param {object} rec - one payroll-history row
 * @param {{ source_type: string, source_id: number, name: string, username?: string, email?: string }} src
 */
function employeeFirstLastName(emp) {
  if (!emp || typeof emp !== 'object') return '';
  const parts = [emp.firstName, emp.middleName, emp.lastName].filter((p) => p != null && String(p).trim() !== '');
  return parts.map((p) => String(p).trim()).join(' ').trim();
}

export function payrollHistoryRecordMatchesSource(rec, src) {
  const emp = rec.employee || {};
  const stubEmp = rec.paystub?.employee || rec.paystubEmployee || {};
  const sel = rec.selectedEmployee || {};
  const fromParts = employeeFirstLastName(emp) || employeeFirstLastName(stubEmp) || employeeFirstLastName(sel);
  const displayName =
    emp.name ||
    emp.fullName ||
    emp.full_name ||
    emp.displayName ||
    stubEmp.name ||
    stubEmp.fullName ||
    stubEmp.full_name ||
    rec.paystub?.employeeName ||
    rec.paystub?.employee_name ||
    sel.name ||
    sel.full_name ||
    sel.fullName ||
    rec.employeeName ||
    rec.employee_name ||
    rec.name ||
    rec.payeeName ||
    rec.payee_name ||
    fromParts ||
    '';

  const nameBlob = [displayName, employeeStringNameBlob(emp), employeeStringNameBlob(stubEmp), employeeStringNameBlob(sel)]
    .filter(Boolean)
    .join(' ')
    .trim();

  const emailsMatch = () => {
    const want = (src.email || '').trim().toLowerCase();
    if (!want || !want.includes('@')) return false;
    const candidates = [emp.email, emp.workEmail, stubEmp.email, sel.email, rec.email].filter(Boolean).map((x) => String(x).trim().toLowerCase());
    return candidates.some((c) => c === want);
  };

  if (src.source_type === 'user') {
    const want = String(src.source_id);
    for (const id of recordEmployeeIds(rec)) {
      if (id === want) return true;
    }
    if (emailsMatch()) return true;
    if (namesLikelyMatch(src.name, displayName)) return true;
    if (nameBlob && namesLikelyMatch(src.name, nameBlob)) return true;
    if (src.username && namesLikelyMatch(src.username, displayName)) return true;
    if (src.username && nameBlob && namesLikelyMatch(src.username, nameBlob)) return true;
    return false;
  }

  // payroll_person — name only
  if (namesLikelyMatch(src.name, displayName)) return true;
  if (nameBlob) return namesLikelyMatch(src.name, nameBlob);
  return false;
}
