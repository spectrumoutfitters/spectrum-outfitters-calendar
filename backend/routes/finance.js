import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import db from '../database/db.js';
import { loadMergedPayrollHistory, mergeImportPayrollHistory } from '../utils/payrollHistoryRecords.js';
import { payrollHistoryRecordMatchesSource } from '../utils/payrollHistoryMatch.js';
import { readPayrollEmployeesFromAnyPath } from '../utils/payrollDataPath.js';
import { readPayrollHistorySyncStatus, runPayrollHistorySyncNow } from '../utils/payrollHistoryAutoSync.js';
import { getSplitPayRunsBySource } from '../utils/payrollSplitRuns.js';
import {
  getTodayInHouston,
  getWeekEndingFridayHouston,
  getWeekStartHouston,
  addDaysInHouston,
} from '../utils/appTimezone.js';

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

function getWeekEndingFriday(dateStr) {
  return getWeekEndingFridayHouston(dateStr);
}

function getWeekStart(weekEndDate) {
  return getWeekStartHouston(weekEndDate);
}

function normLower(v) {
  return String(v || '').trim().toLowerCase();
}

function firstLastName(e) {
  const parts = [e?.firstName, e?.middleName, e?.lastName].filter((x) => x != null && String(x).trim() !== '');
  return parts.map((x) => String(x).trim()).join(' ').trim();
}

/**
 * Get revenue for a single day using one-source-per-day rule:
 * Shop Monkey if present, else payment processor (e.g. Stripe), else manual sales_daily_summary.
 * Never sum two sources for the same day (avoids double-counting).
 */
async function getDailyRevenue(startDate, endDate) {
  const smRows = await db.allAsync(
    'SELECT date, revenue FROM shopmonkey_daily_revenue WHERE date >= ? AND date <= ?',
    [startDate, endDate]
  ).catch(() => []);
  const smByDate = {};
  for (const r of (smRows || [])) smByDate[r.date] = parseFloat(r.revenue) || 0;

  const procRows = await db.allAsync(
    'SELECT date, SUM(revenue) as revenue FROM processor_daily_revenue WHERE date >= ? AND date <= ? GROUP BY date',
    [startDate, endDate]
  ).catch(() => []);
  const procByDate = {};
  for (const r of (procRows || [])) procByDate[r.date] = parseFloat(r.revenue) || 0;

  const manualRows = await db.allAsync(`
    SELECT sale_date,
      (COALESCE(gross_sales,0) + COALESCE(check_amount,0) + COALESCE(cash_amount,0) + COALESCE(zelle_ach_amount,0)) as total
    FROM sales_daily_summary WHERE sale_date >= ? AND sale_date <= ?
  `, [startDate, endDate]);
  const manualByDate = {};
  for (const r of manualRows) manualByDate[r.sale_date] = parseFloat(r.total) || 0;

  const allDates = [...new Set([...Object.keys(smByDate), ...Object.keys(procByDate), ...Object.keys(manualByDate)])].sort();
  let total = 0;
  const daily = allDates.map(date => {
    const rev = smByDate[date] !== undefined
      ? smByDate[date]
      : (procByDate[date] !== undefined ? procByDate[date] : (manualByDate[date] || 0));
    total += rev;
    const source = smByDate[date] !== undefined ? 'shopmonkey' : (procByDate[date] !== undefined ? 'processor' : 'manual');
    return { date, revenue: rev, source };
  });
  return { daily, total };
}

/**
 * Get total expenses for a date range (payroll + manual + bank).
 */
async function getWeeklyExpenses(weekStart, weekEnd) {
  // Payroll
  const employees = await db.allAsync('SELECT id, full_name, weekly_salary, hourly_rate FROM users WHERE is_active = 1');
  let payrollTotal = 0;
  for (const emp of employees) {
    if (emp.weekly_salary && emp.weekly_salary > 0) {
      payrollTotal += parseFloat(emp.weekly_salary);
    } else if (emp.hourly_rate && emp.hourly_rate > 0) {
      const entries = await db.allAsync(
        'SELECT clock_in, clock_out, break_minutes FROM time_entries WHERE user_id = ? AND DATE(clock_in) >= ? AND DATE(clock_in) <= ? AND clock_out IS NOT NULL',
        [emp.id, weekStart, weekEnd]
      );
      let hours = 0;
      for (const e of entries) {
        hours += Math.max(0, (new Date(e.clock_out) - new Date(e.clock_in)) / 3600000 - (e.break_minutes || 0) / 60);
      }
      payrollTotal += hours * parseFloat(emp.hourly_rate);
    }
  }

  // Payroll-only people (contractors, etc.)
  const payrollPeople = await db.allAsync(
    'SELECT id, full_name, weekly_salary FROM payroll_people WHERE is_active = 1 AND weekly_salary > 0'
  );
  for (const p of payrollPeople) {
    payrollTotal += parseFloat(p.weekly_salary) || 0;
  }

  // Manual expenses
  const oneTime = await db.allAsync('SELECT amount FROM business_expenses WHERE frequency = ? AND expense_date >= ? AND expense_date <= ?', ['one_time', weekStart, weekEnd]);
  const weekly = await db.allAsync('SELECT amount FROM business_expenses WHERE frequency = ? AND week_ending_date = ?', ['weekly', weekEnd]);
  const monthYear = weekEnd.substring(0, 7);
  const monthly = await db.allAsync('SELECT amount FROM business_expenses WHERE frequency = ? AND month_year = ?', ['monthly', monthYear]);

  let manualTotal = 0;
  for (const e of oneTime) manualTotal += parseFloat(e.amount) || 0;
  for (const e of weekly) manualTotal += parseFloat(e.amount) || 0;
  for (const e of monthly) manualTotal += (parseFloat(e.amount) || 0) / 4.33;

  // Bank expenses
  const bank = await db.getAsync(
    'SELECT COALESCE(SUM(amount), 0) as total FROM bank_transactions WHERE date >= ? AND date <= ? AND is_business_expense = 1 AND amount > 0',
    [weekStart, weekEnd]
  ).catch(() => ({ total: 0 }));
  const bankTotal = parseFloat(bank?.total || 0);

  return { payroll: payrollTotal, manual: manualTotal, bank: bankTotal, total: payrollTotal + manualTotal + bankTotal };
}

/**
 * GET /api/finance/cash-flow — weekly cash flow for the last N weeks
 */
router.get('/cash-flow', async (req, res) => {
  try {
    const numWeeks = parseInt(req.query.weeks) || 12;

    const todayStr = getTodayInHouston();
    const currentFriday = getWeekEndingFriday(todayStr);

    const weeks = [];
    for (let i = 0; i < numWeeks; i++) {
      const weekEnd = i === 0 ? currentFriday : addDaysInHouston(currentFriday, -7 * i);
      const weekStart = getWeekStart(weekEnd);

      const rev = await getDailyRevenue(weekStart, weekEnd);
      const exp = await getWeeklyExpenses(weekStart, weekEnd);

      weeks.push({
        week_start: weekStart,
        week_ending: weekEnd,
        income: rev.total,
        expenses: exp.total,
        payroll: exp.payroll,
        manual_expenses: exp.manual,
        bank_expenses: exp.bank,
        net: rev.total - exp.total,
      });
    }

    res.json({ weeks });
  } catch (error) {
    console.error('Cash flow error:', error);
    res.status(500).json({ error: 'Failed to compute cash flow' });
  }
});

/**
 * GET /api/finance/forecast — historical + projected weeks
 */
router.get('/forecast', async (req, res) => {
  try {
    const historyWeeks = parseInt(req.query.history) || 12;
    const projectWeeks = parseInt(req.query.project) || 8;

    const todayStr = getTodayInHouston();
    const currentFriday = getWeekEndingFriday(todayStr);

    const historical = [];
    for (let i = 0; i < historyWeeks; i++) {
      const weekEnd = i === 0 ? currentFriday : addDaysInHouston(currentFriday, -7 * i);
      const weekStart = getWeekStart(weekEnd);

      const rev = await getDailyRevenue(weekStart, weekEnd);
      const exp = await getWeeklyExpenses(weekStart, weekEnd);

      historical.unshift({
        week_ending: weekEnd,
        revenue: rev.total,
        expenses: exp.total,
        net: rev.total - exp.total,
      });
    }

    // Need at least 2 weeks with data to forecast
    const weeksWithRevenue = historical.filter(w => w.revenue > 0);
    if (weeksWithRevenue.length < 2) {
      return res.json({ historical, projected: [], method: null, weeks_used: 0, message: 'Insufficient data for forecast' });
    }

    // Simple linear trend or average
    const n = weeksWithRevenue.length;
    let method = 'average';
    let avgRevenue = weeksWithRevenue.reduce((s, w) => s + w.revenue, 0) / n;
    let avgExpenses = weeksWithRevenue.reduce((s, w) => s + w.expenses, 0) / n;

    // Try linear trend if 4+ weeks
    if (n >= 4) {
      method = 'trend';
      const revSlope = linearSlope(weeksWithRevenue.map(w => w.revenue));
      const expSlope = linearSlope(weeksWithRevenue.map(w => w.expenses));
      const lastRev = weeksWithRevenue[n - 1].revenue;
      const lastExp = weeksWithRevenue[n - 1].expenses;

      const projected = [];
      for (let i = 1; i <= projectWeeks; i++) {
        const fri = new Date(currentFriday + 'T12:00:00');
        fri.setDate(fri.getDate() + 7 * i);
        const weekEnd = fri.toISOString().split('T')[0];
        const projRev = Math.max(0, lastRev + revSlope * i);
        const projExp = Math.max(0, lastExp + expSlope * i);
        projected.push({
          week_ending: weekEnd,
          projected_revenue: Math.round(projRev * 100) / 100,
          projected_expenses: Math.round(projExp * 100) / 100,
          projected_net: Math.round((projRev - projExp) * 100) / 100,
        });
      }

      return res.json({ historical, projected, method, weeks_used: n });
    }

    // Fallback: average
    const projected = [];
    for (let i = 1; i <= projectWeeks; i++) {
      const fri = new Date(currentFriday + 'T12:00:00');
      fri.setDate(fri.getDate() + 7 * i);
      const weekEnd = fri.toISOString().split('T')[0];
      projected.push({
        week_ending: weekEnd,
        projected_revenue: Math.round(avgRevenue * 100) / 100,
        projected_expenses: Math.round(avgExpenses * 100) / 100,
        projected_net: Math.round((avgRevenue - avgExpenses) * 100) / 100,
      });
    }

    res.json({ historical, projected, method, weeks_used: n });
  } catch (error) {
    console.error('Forecast error:', error);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

function linearSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

// --- Payroll people (add people to payroll without full user accounts) ---

router.get('/payroll-people', async (req, res) => {
  try {
    const rows = await db.allAsync(
      'SELECT id, full_name, weekly_salary, hourly_rate, is_active, notes, created_at, split_reimbursable_amount, split_reimbursable_notes, split_reimbursable_period FROM payroll_people ORDER BY full_name ASC'
    );
    res.json({ people: rows });
  } catch (error) {
    console.error('Get payroll people error:', error);
    res.status(500).json({ error: 'Failed to load payroll people' });
  }
});

router.post('/payroll-people', async (req, res) => {
  try {
    const { full_name, weekly_salary, hourly_rate, notes, split_reimbursable_amount, split_reimbursable_notes, split_reimbursable_period } = req.body;
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    const weekly = parseFloat(weekly_salary) || 0;
    const hourly = parseFloat(hourly_rate) || 0;
    if (weekly <= 0 && hourly <= 0) {
      return res.status(400).json({ error: 'Enter either a weekly salary or hourly rate' });
    }
    const splitAmt = parseFloat(split_reimbursable_amount) || 0;
    const splitPeriod = split_reimbursable_period === 'monthly' ? 'monthly' : 'weekly';
    const result = await db.runAsync(
      'INSERT INTO payroll_people (full_name, weekly_salary, hourly_rate, notes, split_reimbursable_amount, split_reimbursable_notes, split_reimbursable_period) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [full_name.trim(), weekly, hourly, (notes || '').trim() || null, splitAmt, (split_reimbursable_notes || '').trim() || null, splitPeriod]
    );
    const id = result.lastID;
    const row = await db.getAsync('SELECT id, full_name, weekly_salary, hourly_rate, is_active, notes, created_at, split_reimbursable_amount, split_reimbursable_notes, split_reimbursable_period FROM payroll_people WHERE id = ?', [id]);
    res.status(201).json({ person: row });
  } catch (error) {
    console.error('Create payroll person error:', error);
    res.status(500).json({ error: 'Failed to add payroll person' });
  }
});

router.put('/payroll-people/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { full_name, weekly_salary, hourly_rate, is_active, notes, split_reimbursable_amount, split_reimbursable_notes, split_reimbursable_period } = req.body;
    const existing = await db.getAsync('SELECT id FROM payroll_people WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Payroll person not found' });
    const updates = [];
    const values = [];
    if (full_name !== undefined) { updates.push('full_name = ?'); values.push(full_name.trim()); }
    if (weekly_salary !== undefined) { updates.push('weekly_salary = ?'); values.push(parseFloat(weekly_salary) || 0); }
    if (hourly_rate !== undefined) { updates.push('hourly_rate = ?'); values.push(parseFloat(hourly_rate) || 0); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push((notes || '').trim() || null); }
    if (split_reimbursable_amount !== undefined) { updates.push('split_reimbursable_amount = ?'); values.push(parseFloat(split_reimbursable_amount) || 0); }
    if (split_reimbursable_notes !== undefined) { updates.push('split_reimbursable_notes = ?'); values.push((split_reimbursable_notes || '').trim() || null); }
    if (split_reimbursable_period !== undefined) { updates.push('split_reimbursable_period = ?'); values.push(split_reimbursable_period === 'monthly' ? 'monthly' : 'weekly'); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    await db.runAsync(`UPDATE payroll_people SET ${updates.join(', ')} WHERE id = ?`, values);
    const row = await db.getAsync('SELECT id, full_name, weekly_salary, hourly_rate, is_active, notes, created_at, split_reimbursable_amount, split_reimbursable_notes, split_reimbursable_period FROM payroll_people WHERE id = ?', [id]);
    res.json({ person: row });
  } catch (error) {
    console.error('Update payroll person error:', error);
    res.status(500).json({ error: 'Failed to update payroll person' });
  }
});

router.delete('/payroll-people/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await db.getAsync('SELECT id FROM payroll_people WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Payroll person not found' });
    await db.runAsync('UPDATE payroll_people SET is_active = 0 WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete payroll person error:', error);
    res.status(500).json({ error: 'Failed to remove payroll person' });
  }
});

// --- Split salary reimbursements (other business pays this business back) ---

/**
 * POST /api/finance/payroll-history-import — merge payroll-history.json contents into SQLite (+ optional local file).
 * Admin-only; use once on production (upload from the machine that runs the Payroll app).
 */
router.post('/payroll-history-import', async (req, res) => {
  try {
    let records = req.body?.records;
    if (!Array.isArray(records) && Array.isArray(req.body)) records = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Body must include a non-empty "records" array (Payroll System pay history).' });
    }
    const { imported, total } = await mergeImportPayrollHistory(records);
    res.json({ success: true, imported, total });
  } catch (error) {
    console.error('Payroll history import error:', error);
    res.status(500).json({ error: error.message || 'Failed to import payroll history' });
  }
});

/**
 * POST /api/finance/payroll-history-sync-now
 * Pull latest payroll-history.json from PayrollData into Calendar DB immediately.
 */
router.post('/payroll-history-sync-now', async (_req, res) => {
  try {
    const result = await runPayrollHistorySyncNow('manual_button');
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Payroll history sync-now error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync payroll history from PayrollData' });
  }
});

/** GET /api/finance/reimbursements — list people with split + payments received, or filter by source */
router.get('/reimbursements', async (req, res) => {
  try {
    const { source_type, source_id } = req.query;
    let payments = await db.allAsync(
      'SELECT id, source_type, source_id, received_date, amount, notes, created_at FROM payroll_reimbursements ORDER BY received_date DESC, id DESC'
    );
    if (source_type && source_id) {
      payments = payments.filter(p => p.source_type === source_type && p.source_id === parseInt(source_id, 10));
    }
    const usersWithSplit = await db.allAsync(
      "SELECT id, username, full_name, email, weekly_salary, split_reimbursable_amount, split_reimbursable_notes, split_reimbursable_period FROM users WHERE is_active = 1 AND COALESCE(split_reimbursable_amount, 0) > 0"
    );
    const peopleWithSplit = await db.allAsync(
      'SELECT id, full_name, weekly_salary, split_reimbursable_amount, split_reimbursable_notes, split_reimbursable_period FROM payroll_people WHERE is_active = 1 AND COALESCE(split_reimbursable_amount, 0) > 0'
    );
    const sources = [
      ...usersWithSplit.map(u => ({
        source_type: 'user',
        source_id: u.id,
        name: u.full_name,
        username: (u.username || '').trim() || undefined,
        email: (u.email || '').trim() || undefined,
        expected_amount: parseFloat(u.split_reimbursable_amount) || 0,
        expected_period: u.split_reimbursable_period || 'weekly',
        notes: u.split_reimbursable_notes
      })),
      ...peopleWithSplit.map(p => ({ source_type: 'payroll_person', source_id: p.id, name: p.full_name, expected_amount: parseFloat(p.split_reimbursable_amount) || 0, expected_period: p.split_reimbursable_period || 'weekly', notes: p.split_reimbursable_notes }))
    ];
    const totalReceivedBySource = {};
    for (const p of payments) {
      const key = `${p.source_type}:${p.source_id}`;
      totalReceivedBySource[key] = (totalReceivedBySource[key] || 0) + (parseFloat(p.amount) || 0);
    }

    const { records: payrollHistory, pathUsed: payrollHistoryPath, dbCount, fileCount } = await loadMergedPayrollHistory();
    const { records: payrollEmployees } = readPayrollEmployeesFromAnyPath();
    const payrollHistoryRowCount = payrollHistory.length;
    const payrollEmployeeById = new Map();
    for (const e of payrollEmployees) {
      const id = String(e?.id || '').trim();
      if (id) payrollEmployeeById.set(id, e);
    }

    const payRecordAmount = (r) => {
      for (const k of ['grossPay', 'netPay', 'amount', 'total', 'totalPay', 'payAmount', 'totalAmount']) {
        const x = parseFloat(r[k]);
        if (Number.isFinite(x) && x > 0) return x;
      }
      return 0;
    };

    const sourceMatchesRecord = (rec, src) => {
      if (payrollHistoryRecordMatchesSource(rec, src)) return true;
      const empId = String(rec?.employee?.id || rec?.employeeId || rec?.employee_id || '').trim();
      if (!empId) return false;
      const linked = payrollEmployeeById.get(empId);
      if (!linked) return false;

      if (src.source_type === 'user') {
        // Strong link when Payroll employee carries calendarId from employee sync.
        if (String(linked.calendarId || '').trim() === String(src.source_id)) return true;
        // Fallback to email/name from Payroll employees.json.
        const linkedEmail = normLower(linked.email);
        if (linkedEmail && src.email && linkedEmail === normLower(src.email)) return true;
        const linkedName = linked.name || firstLastName(linked);
        if (linkedName) {
          return payrollHistoryRecordMatchesSource(
            { employee: { name: linkedName } },
            src
          );
        }
        return false;
      }

      const linkedName = linked.name || firstLastName(linked);
      if (!linkedName) return false;
      return payrollHistoryRecordMatchesSource({ employee: { name: linkedName } }, src);
    };

    const splitRunsBySource = await getSplitPayRunsBySource();
    const payRecordsBySource = {};
    for (const src of sources) {
      const records = payrollHistory.filter((rec) => sourceMatchesRecord(rec, src));
      const payrollFileRecords = records.map((r) => {
        const payDate = r.payDate || r.date || r.processedDate || '';
        const amount = payRecordAmount(r);
        return { pay_date: payDate, amount };
      });
      const splitRuns = splitRunsBySource[`${src.source_type}:${src.source_id}`] || [];
      const payRecords = [...payrollFileRecords, ...splitRuns]
        .sort((a, b) => (a.pay_date || '').localeCompare(b.pay_date || ''));
      const totalPaidFromPayroll = payRecords.reduce((sum, r) => sum + r.amount, 0);
      let amountOwedEstimate = 0;
      if (src.expected_amount > 0 && payRecords.length > 0) {
        const received = totalReceivedBySource[`${src.source_type}:${src.source_id}`] || 0;
        if (src.expected_period === 'monthly') {
          const months = new Set(payRecords.map((r) => (r.pay_date || '').slice(0, 7)).filter(Boolean));
          amountOwedEstimate = Math.max(0, months.size * src.expected_amount - received);
        } else {
          amountOwedEstimate = Math.max(0, payRecords.length * src.expected_amount - received);
        }
      }
      payRecordsBySource[`${src.source_type}:${src.source_id}`] = { pay_records: payRecords, total_paid_from_payroll: totalPaidFromPayroll, amount_owed_estimate: amountOwedEstimate };
    }
    sources.forEach((s) => {
      const key = `${s.source_type}:${s.source_id}`;
      const data = payRecordsBySource[key];
      if (data) {
        s.pay_records = data.pay_records;
        s.total_paid_from_payroll = data.total_paid_from_payroll;
        s.amount_owed_estimate = data.amount_owed_estimate;
      } else {
        s.pay_records = [];
        s.total_paid_from_payroll = 0;
        s.amount_owed_estimate = 0;
      }
    });

    const payrollSyncStatus = await readPayrollHistorySyncStatus();

    res.json({
      sources,
      payments,
      total_received_by_source: totalReceivedBySource,
      payroll_history_path: payrollHistoryPath || null,
      payroll_history_row_count: payrollHistoryRowCount,
      payroll_history_db_count: dbCount,
      payroll_history_file_count: fileCount,
      payroll_history_sync_status: payrollSyncStatus,
    });
  } catch (error) {
    console.error('Get reimbursements error:', error);
    res.status(500).json({ error: 'Failed to load reimbursements' });
  }
});

/** POST /api/finance/reimbursements — record a reimbursement payment received */
router.post('/reimbursements', async (req, res) => {
  try {
    const { source_type, source_id, received_date, amount, notes } = req.body;
    if (!source_type || !source_id || !received_date || amount === undefined) {
      return res.status(400).json({ error: 'source_type, source_id, received_date, and amount are required' });
    }
    if (source_type !== 'user' && source_type !== 'payroll_person') {
      return res.status(400).json({ error: 'source_type must be user or payroll_person' });
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    const sid = parseInt(source_id, 10);
    if (source_type === 'user') {
      const u = await db.getAsync('SELECT id FROM users WHERE id = ?', [sid]);
      if (!u) return res.status(404).json({ error: 'User not found' });
    } else {
      const p = await db.getAsync('SELECT id FROM payroll_people WHERE id = ?', [sid]);
      if (!p) return res.status(404).json({ error: 'Payroll person not found' });
    }
    await db.runAsync(
      'INSERT INTO payroll_reimbursements (source_type, source_id, received_date, amount, notes) VALUES (?, ?, ?, ?, ?)',
      [source_type, sid, received_date, amt, (notes || '').trim() || null]
    );
    const row = await db.getAsync(
      'SELECT id, source_type, source_id, received_date, amount, notes, created_at FROM payroll_reimbursements ORDER BY id DESC LIMIT 1'
    );
    res.status(201).json({ payment: row });
  } catch (error) {
    console.error('Post reimbursement error:', error);
    res.status(500).json({ error: 'Failed to record reimbursement' });
  }
});

export default router;
