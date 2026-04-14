import db from '../database/db.js';
import { getTodayInHouston, addDaysInHouston, getHoustonDayOfWeek } from './appTimezone.js';

function toNumber(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function previousFridayFrom(dateStr) {
  const d = getHoustonDayOfWeek(dateStr);
  const daysBack = d >= 5 ? (d - 5) : (d + 2);
  return addDaysInHouston(dateStr, -daysBack);
}

/**
 * Record one weekly pay-run row for split sources for the previous Friday.
 * Idempotent via UNIQUE(source_type, source_id, week_ending_date).
 */
export async function recordWeeklySplitPayRuns(opts = {}) {
  const today = opts.today || getTodayInHouston();
  const weekEnding = opts.weekEnding || previousFridayFrom(today);

  const users = await db.allAsync(
    `SELECT id, full_name, weekly_salary, split_reimbursable_amount
     FROM users
     WHERE is_active = 1 AND COALESCE(split_reimbursable_amount, 0) > 0`
  );
  const people = await db.allAsync(
    `SELECT id, full_name, weekly_salary, split_reimbursable_amount
     FROM payroll_people
     WHERE is_active = 1 AND COALESCE(split_reimbursable_amount, 0) > 0`
  );

  let inserted = 0;
  const insertSql = `
    INSERT OR IGNORE INTO payroll_split_pay_runs (source_type, source_id, week_ending_date, amount, source_label)
    VALUES (?, ?, ?, ?, ?)
  `;

  for (const u of users) {
    const amount = toNumber(u.weekly_salary) > 0 ? toNumber(u.weekly_salary) : toNumber(u.split_reimbursable_amount);
    if (amount <= 0) continue;
    const r = await db.runAsync(insertSql, ['user', u.id, weekEnding, amount, u.full_name || null]);
    if (r?.changes) inserted += r.changes;
  }
  for (const p of people) {
    const amount = toNumber(p.weekly_salary) > 0 ? toNumber(p.weekly_salary) : toNumber(p.split_reimbursable_amount);
    if (amount <= 0) continue;
    const r = await db.runAsync(insertSql, ['payroll_person', p.id, weekEnding, amount, p.full_name || null]);
    if (r?.changes) inserted += r.changes;
  }

  return { inserted, weekEnding };
}

export async function getSplitPayRunsBySource() {
  const rows = await db.allAsync(
    `SELECT source_type, source_id, week_ending_date, amount
     FROM payroll_split_pay_runs
     ORDER BY week_ending_date ASC, id ASC`
  );
  const byKey = {};
  for (const r of rows) {
    const key = `${r.source_type}:${r.source_id}`;
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push({ pay_date: r.week_ending_date, amount: toNumber(r.amount) });
  }
  return byKey;
}

