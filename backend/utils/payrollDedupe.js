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

function payRecordTimeMs(payDate) {
  const d = normalizePayRecordDate(payDate);
  return d ? Date.parse(`${d}T12:00:00Z`) : NaN;
}

function withinPayRecordWindow(a, b, windowMs) {
  const t = payRecordTimeMs(a?.pay_date);
  const et = payRecordTimeMs(b?.pay_date);
  return Number.isFinite(t) && Number.isFinite(et) && Math.abs(t - et) <= windowMs;
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
  const windowMs = 6 * 86400000;
  for (const r of sorted) {
    const amt = normPayAmount(r?.amount);
    let dup = false;
    if (Number.isFinite(payRecordTimeMs(r.pay_date))) {
      for (const ex of out) {
        if (normPayAmount(ex.amount) !== amt) continue;
        if (withinPayRecordWindow(r, ex, windowMs)) {
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

/** Public pay-record shape for API responses (strips internal merge tags). */
export function toPublicPayRecord(r) {
  return {
    pay_date: r?.pay_date,
    amount: r?.amount,
  };
}

function withSplitTag(r, fromSplitRun) {
  const out = toPublicPayRecord(r);
  if (fromSplitRun) out.from_split_run = true;
  return out;
}

/**
 * Merge imported payroll history with synthetic weekly split-run markers.
 * Prefer history whenever a split run falls in the same 6-day window, even if
 * amounts differ (weekly_salary==0 stores split_reimbursable_amount, which is
 * often not the history gross). Keeps generic same-amount dedupe unchanged.
 *
 * Uncovered split rows keep `from_split_run: true` so later same-person rollups
 * can still prefer history; strip with `toPublicPayRecord` before responding.
 */
export function mergePayrollHistoryWithSplitRuns(historyRecords, splitRuns, opts = {}) {
  const windowDays = Number.isFinite(opts.windowDays) ? opts.windowDays : 6;
  const windowMs = windowDays * 86400000;
  const history = dedupePayRecordsList(
    (historyRecords || []).map((r) => withSplitTag(r, false))
  );
  const uncoveredSplitRuns = [];
  for (const sr of splitRuns || []) {
    const covered = history.some((hr) => withinPayRecordWindow(sr, hr, windowMs));
    if (!covered) uncoveredSplitRuns.push(withSplitTag(sr, true));
  }
  // Preserve tags: generic dedupe keeps object identity for first-seen rows.
  return dedupePayRecordsList([...history, ...uncoveredSplitRuns]);
}

/**
 * When rolling up the same person across sources, prefer non-split (history)
 * rows over split-run markers in the same 6-day window.
 */
export function mergePayRecordsPreferringHistory(listA, listB) {
  const all = [...(listA || []), ...(listB || [])];
  const history = all.filter((r) => !r?.from_split_run);
  const split = all.filter((r) => r?.from_split_run);
  if (split.length === 0) {
    return dedupePayRecordsList(all.map((r) => toPublicPayRecord(r)));
  }
  return mergePayrollHistoryWithSplitRuns(history, split);
}
