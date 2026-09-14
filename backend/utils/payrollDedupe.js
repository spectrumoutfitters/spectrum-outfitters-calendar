/**
 * Avoid double-counting when the same person exists as a Calendar user (weekly salary)
 * and again as payroll_people, or as duplicate payroll_people rows.
 */

export function normalizePayrollDisplayName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Names of users who already contribute weekly salary to payroll (not hourly-only).
 * @param {Array<{ full_name?: string, weekly_salary?: number }>} employees
 */
export function normalizedNamesWithWeeklySalary(employees) {
  const set = new Set();
  for (const e of employees || []) {
    const w = parseFloat(e.weekly_salary) || 0;
    if (w > 0) {
      set.add(normalizePayrollDisplayName(e.full_name));
    }
  }
  return set;
}

function normPayAmount(amt) {
  const x = parseFloat(amt);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

/** Import vs split-run week-ending: Friday stub vs Saturday/Monday deposit still same pay week. */
export const PAY_RECORD_NEAR_DUP_WINDOW_MS = 6 * 86400000;

export function isSplitPlaceholderRecord(r) {
  return r?.splitPlaceholder === true;
}

function payRecordTimeMs(r) {
  const d = normalizePayRecordDate(r?.pay_date);
  return d ? Date.parse(`${d}T12:00:00Z`) : NaN;
}

function withinNearDupWindow(a, b) {
  const ta = payRecordTimeMs(a);
  const tb = payRecordTimeMs(b);
  return Number.isFinite(ta) && Number.isFinite(tb) && Math.abs(ta - tb) <= PAY_RECORD_NEAR_DUP_WINDOW_MS;
}

/**
 * Calendar day for matching (avoids duplicate lines when one source uses "2026-04-14" and another "2026-04-14T16:28:00.000Z").
 */
export function normalizePayRecordDate(payDate) {
  const s = String(payDate || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

export function payRecordDedupeKey(r) {
  const amt = normPayAmount(r?.amount);
  const day = normalizePayRecordDate(r?.pay_date);
  if (day) return `${day}|${amt}`;
  return `raw:${String(r?.pay_date || '')}|${amt}`;
}

/** Dedupe by calendar day + amount, then merge same-amount rows within 6 days (import vs split-run week-ending). */
export function dedupePayRecordsList(records) {
  const seen = new Set();
  const first = [];
  for (const r of records || []) {
    const k = payRecordDedupeKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    first.push(r);
  }
  const sorted = first.sort((a, b) => {
    const da = normalizePayRecordDate(a.pay_date) || String(a.pay_date || '');
    const db = normalizePayRecordDate(b.pay_date) || String(b.pay_date || '');
    return da.localeCompare(db);
  });
  const out = [];
  for (const r of sorted) {
    const amt = normPayAmount(r?.amount);
    const d = normalizePayRecordDate(r.pay_date);
    const t = d ? Date.parse(`${d}T12:00:00Z`) : NaN;
    let dup = false;
    if (Number.isFinite(t)) {
      for (const ex of out) {
        if (normPayAmount(ex.amount) !== amt) continue;
        const ed = normalizePayRecordDate(ex.pay_date);
        const et = ed ? Date.parse(`${ed}T12:00:00Z`) : NaN;
        if (Number.isFinite(et) && Math.abs(t - et) <= PAY_RECORD_NEAR_DUP_WINDOW_MS) {
          dup = true;
          break;
        }
      }
    }
    if (!dup) out.push(r);
  }
  return out.sort((a, b) => {
    const da = normalizePayRecordDate(a.pay_date) || String(a.pay_date || '');
    const db = normalizePayRecordDate(b.pay_date) || String(b.pay_date || '');
    return da.localeCompare(db);
  });
}

/**
 * Split-run rows are week placeholders (synthetic). When payroll history already covers
 * that week, drop the placeholder even if amounts differ (hourly gross vs reimbursable
 * slice, overtime, salary change after INSERT OR IGNORE). Real history rows with
 * different amounts in the same week (paycheck + bonus) are kept.
 *
 * Extra placeholders in the same window (Calendar user + payroll_people for one person)
 * collapse to one so `payRecords.length * expected_amount` is not doubled.
 */
export function mergePayRecordsPreferringReal(records) {
  const list = Array.isArray(records) ? records : [];
  const real = list.filter((r) => !isSplitPlaceholderRecord(r));
  const placeholders = list.filter((r) => isSplitPlaceholderRecord(r));
  const keptPlaceholders = [];
  for (const s of placeholders) {
    if (real.some((h) => withinNearDupWindow(h, s))) continue;
    if (keptPlaceholders.some((p) => withinNearDupWindow(p, s))) continue;
    keptPlaceholders.push(s);
  }
  return dedupePayRecordsList([...real, ...keptPlaceholders]);
}
