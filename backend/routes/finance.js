import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import db from '../database/db.js';
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

export default router;
