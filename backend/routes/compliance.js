import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { callClaude, isAIEnabled } from '../utils/aiService.js';
import {
  getTodayInHouston,
  formatDateInHouston,
  parseHoustonDate,
  getWeekStartHouston,
  getWeekEndingFridayHouston,
  addDaysInHouston,
} from '../utils/appTimezone.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Use Houston (America/Chicago) for all "today" and date logic
function getTodayInCentral() {
  return getTodayInHouston();
}

// Calculate due date based on obligation rules
function calculateDueDate(obligation, periodStart, periodEnd) {
  const rules = JSON.parse(obligation.due_rule_json || '{}');
  const endDate = new Date(periodEnd);
  
  if (obligation.frequency === 'monthly') {
    // Monthly: due on specific day of following month
    const dueDate = new Date(endDate);
    dueDate.setMonth(dueDate.getMonth() + (rules.offset_months || 1));
    dueDate.setDate(rules.day_of_month || obligation.due_day || 15);
    return dueDate.toISOString().split('T')[0];
  } else if (obligation.frequency === 'quarterly') {
    // Quarterly: use quarter-specific due dates
    const month = endDate.getMonth() + 1;
    let quarter;
    if (month <= 3) quarter = 'Q1';
    else if (month <= 6) quarter = 'Q2';
    else if (month <= 9) quarter = 'Q3';
    else quarter = 'Q4';
    
    if (rules.quarters && rules.quarters[quarter]) {
      const dueStr = rules.quarters[quarter].due;
      const year = quarter === 'Q4' ? endDate.getFullYear() + 1 : endDate.getFullYear();
      return `${year}-${dueStr}`;
    }
    // Fallback: last day of month after quarter
    const dueDate = new Date(endDate);
    dueDate.setMonth(dueDate.getMonth() + 1);
    dueDate.setDate(0); // Last day of previous month (which is the next month's last day)
    return dueDate.toISOString().split('T')[0];
  } else if (obligation.frequency === 'annual') {
    // Annual: due on specific date of following year
    const dueYear = endDate.getFullYear() + 1;
    const dueMonth = rules.due_month || 1;
    const dueDay = rules.due_day || obligation.due_day || 31;
    return `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
  }
  
  // Default: 30 days after period end
  const dueDate = new Date(endDate);
  dueDate.setDate(dueDate.getDate() + 30);
  return dueDate.toISOString().split('T')[0];
}

// Generate period label
function getPeriodLabel(obligation, periodStart, periodEnd) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  
  if (obligation.frequency === 'monthly') {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else if (obligation.frequency === 'quarterly') {
    const month = end.getMonth() + 1;
    let quarter;
    if (month <= 3) quarter = 'Q1';
    else if (month <= 6) quarter = 'Q2';
    else if (month <= 9) quarter = 'Q3';
    else quarter = 'Q4';
    return `${quarter} ${end.getFullYear()}`;
  } else if (obligation.frequency === 'annual') {
    return `${end.getFullYear()}`;
  }
  return `${periodStart} - ${periodEnd}`;
}

// Get current and next periods for an obligation
function getPeriodsToGenerate(obligation) {
  const today = new Date(getTodayInCentral());
  const periods = [];
  
  if (obligation.frequency === 'monthly') {
    // Current month
    const currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    periods.push({
      start: currentStart.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0]
    });
    
    // Previous month (might still be due)
    const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    periods.push({
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0]
    });
    
    // Next month
    const nextStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    periods.push({
      start: nextStart.toISOString().split('T')[0],
      end: nextEnd.toISOString().split('T')[0]
    });
  } else if (obligation.frequency === 'quarterly') {
    const currentQuarter = Math.floor(today.getMonth() / 3);
    
    // Current quarter
    const currentStart = new Date(today.getFullYear(), currentQuarter * 3, 1);
    const currentEnd = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
    periods.push({
      start: currentStart.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0]
    });
    
    // Previous quarter
    const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
    const prevYear = currentQuarter === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const prevStart = new Date(prevYear, prevQuarter * 3, 1);
    const prevEnd = new Date(prevYear, (prevQuarter + 1) * 3, 0);
    periods.push({
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0]
    });
  } else if (obligation.frequency === 'annual') {
    // Current year
    const currentStart = new Date(today.getFullYear(), 0, 1);
    const currentEnd = new Date(today.getFullYear(), 11, 31);
    periods.push({
      start: currentStart.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0]
    });
    
    // Previous year (might still be due)
    const prevStart = new Date(today.getFullYear() - 1, 0, 1);
    const prevEnd = new Date(today.getFullYear() - 1, 11, 31);
    periods.push({
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0]
    });
  }
  
  return periods;
}

// Ensure instances exist for current/upcoming periods
async function ensureInstances(io) {
  const today = getTodayInCentral();
  const obligations = await db.allAsync(
    'SELECT * FROM compliance_obligations WHERE enabled = 1'
  );
  
  for (const obligation of obligations) {
    const periods = getPeriodsToGenerate(obligation);
    
    for (const period of periods) {
      const dueDate = calculateDueDate(obligation, period.start, period.end);
      const periodLabel = getPeriodLabel(obligation, period.start, period.end);
      
      // Insert or ignore if exists
      try {
        await db.runAsync(`
          INSERT OR IGNORE INTO compliance_instances 
          (obligation_id, period_start, period_end, period_label, due_date)
          VALUES (?, ?, ?, ?, ?)
        `, [obligation.id, period.start, period.end, periodLabel, dueDate]);
      } catch (e) {
        // Ignore duplicate errors
      }
    }
  }
  
  // Update statuses and send notifications
  await updateInstanceStatuses(io);
}

// Update instance statuses based on dates
async function updateInstanceStatuses(io) {
  const today = getTodayInCentral();
  
  // Get all non-paid/filed instances
  const instances = await db.allAsync(`
    SELECT ci.*, co.name as obligation_name, co.reminder_days_before
    FROM compliance_instances ci
    JOIN compliance_obligations co ON ci.obligation_id = co.id
    WHERE ci.status NOT IN ('paid', 'filed')
  `);
  
  for (const instance of instances) {
    const dueDate = new Date(instance.due_date);
    const todayDate = new Date(today);
    const daysUntilDue = Math.ceil((dueDate - todayDate) / (1000 * 60 * 60 * 24));
    
    let newStatus = instance.status;
    
    if (daysUntilDue < 0) {
      newStatus = 'overdue';
    } else if (daysUntilDue <= (instance.reminder_days_before || 7)) {
      newStatus = 'due_soon';
    } else {
      newStatus = 'pending';
    }
    
    if (newStatus !== instance.status) {
      await db.runAsync(
        'UPDATE compliance_instances SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newStatus, instance.id]
      );
      
      // Send notification for overdue or due_soon
      if (io && (newStatus === 'overdue' || newStatus === 'due_soon')) {
        const notifyFlag = newStatus === 'overdue' ? 'notified_overdue' : 'notified_due_soon';
        
        if (!instance[notifyFlag]) {
          // Create admin board message
          const emoji = newStatus === 'overdue' ? '🚨' : '⚠️';
          const urgency = newStatus === 'overdue' ? 'OVERDUE' : 'Due Soon';
          const message = `${emoji} Tax Compliance ${urgency}: ${instance.obligation_name} for ${instance.period_label} is ${newStatus === 'overdue' ? 'overdue!' : 'due on ' + instance.due_date}`;
          
          try {
            await db.runAsync(`
              INSERT INTO messages (sender_id, message, is_team_message, board_type)
              VALUES (1, ?, 1, 'admin_board')
            `, [message]);
            
            // Emit to admin room
            io.to('admin').emit('admin_notification', {
              type: 'compliance_alert',
              urgency: newStatus,
              message: message,
              instance_id: instance.id,
              timestamp: new Date().toISOString()
            });
            
            // Mark as notified
            await db.runAsync(
              `UPDATE compliance_instances SET ${notifyFlag} = 1 WHERE id = ?`,
              [instance.id]
            );
          } catch (e) {
            console.error('Error sending compliance notification:', e);
          }
        }
      }
    }
  }
}

// ============ DASHBOARD ============

// GET /api/compliance/dashboard - Main dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const io = req.app.get('io');
    await ensureInstances(io);
    
    const today = getTodayInCentral();
    
    // Get all instances with obligation info
    const instances = await db.allAsync(`
      SELECT 
        ci.*,
        co.name as obligation_name,
        co.type as obligation_type,
        co.jurisdiction,
        co.frequency,
        co.notes as obligation_notes
      FROM compliance_instances ci
      JOIN compliance_obligations co ON ci.obligation_id = co.id
      WHERE co.enabled = 1
      ORDER BY ci.due_date ASC
    `);
    
    // Categorize
    const overdue = instances.filter(i => i.status === 'overdue');
    const dueSoon = instances.filter(i => i.status === 'due_soon');
    const upcoming = instances.filter(i => i.status === 'pending');
    const completed = instances.filter(i => i.status === 'paid' || i.status === 'filed');
    
    // Get recent sales summary
    const salesSummary = await db.getAsync(`
      SELECT 
        COUNT(*) as days_entered,
        SUM(gross_sales) as total_gross,
        SUM(taxable_sales) as total_taxable,
        SUM(sales_tax_collected) as total_tax_collected,
        MIN(sale_date) as earliest_date,
        MAX(sale_date) as latest_date
      FROM sales_daily_summary
      WHERE sale_date >= date('now', '-30 days')
    `);
    
    // Get obligations for management
    const obligations = await db.allAsync(
      'SELECT * FROM compliance_obligations ORDER BY type, jurisdiction'
    );
    
    res.json({
      date: today,
      summary: {
        overdue: overdue.length,
        dueSoon: dueSoon.length,
        upcoming: upcoming.length,
        completed: completed.length
      },
      overdue,
      dueSoon,
      upcoming,
      recentCompleted: completed.slice(0, 5),
      salesSummary,
      obligations
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ INSTANCES ============

// POST /api/compliance/instances/:id/mark-paid - Record payment
router.post('/instances/:id/mark-paid', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, confirmation_number, method, notes, paid_at } = req.body;
    
    const instance = await db.getAsync(
      'SELECT * FROM compliance_instances WHERE id = ?',
      [id]
    );
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Record payment
    await db.runAsync(`
      INSERT INTO compliance_payments 
      (instance_id, payment_type, paid_at, amount, confirmation_number, method, notes, recorded_by)
      VALUES (?, 'payment', ?, ?, ?, ?, ?, ?)
    `, [
      id,
      paid_at || new Date().toISOString(),
      amount || null,
      confirmation_number || null,
      method || null,
      notes || null,
      req.user.id
    ]);
    
    // Update instance
    await db.runAsync(`
      UPDATE compliance_instances 
      SET status = 'paid', amount_paid = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [amount || instance.amount_due_estimate, id]);
    
    const updated = await db.getAsync(`
      SELECT ci.*, co.name as obligation_name
      FROM compliance_instances ci
      JOIN compliance_obligations co ON ci.obligation_id = co.id
      WHERE ci.id = ?
    `, [id]);
    
    res.json({ instance: updated, message: 'Payment recorded successfully' });
  } catch (error) {
    console.error('Mark paid error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/compliance/instances/:id/mark-filed - Record filing
router.post('/instances/:id/mark-filed', async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmation_number, method, notes, filed_at } = req.body;
    
    const instance = await db.getAsync(
      'SELECT * FROM compliance_instances WHERE id = ?',
      [id]
    );
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Record filing
    await db.runAsync(`
      INSERT INTO compliance_payments 
      (instance_id, payment_type, paid_at, confirmation_number, method, notes, recorded_by)
      VALUES (?, 'filing', ?, ?, ?, ?, ?)
    `, [
      id,
      filed_at || new Date().toISOString(),
      confirmation_number || null,
      method || null,
      notes || null,
      req.user.id
    ]);
    
    // Update instance
    await db.runAsync(`
      UPDATE compliance_instances 
      SET status = 'filed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);
    
    const updated = await db.getAsync(`
      SELECT ci.*, co.name as obligation_name
      FROM compliance_instances ci
      JOIN compliance_obligations co ON ci.obligation_id = co.id
      WHERE ci.id = ?
    `, [id]);
    
    res.json({ instance: updated, message: 'Filing recorded successfully' });
  } catch (error) {
    console.error('Mark filed error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/compliance/instances/:id/payments - Get payment history for instance
router.get('/instances/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    
    const payments = await db.allAsync(`
      SELECT cp.*, u.full_name as recorded_by_name
      FROM compliance_payments cp
      LEFT JOIN users u ON cp.recorded_by = u.id
      WHERE cp.instance_id = ?
      ORDER BY cp.paid_at DESC
    `, [id]);
    
    res.json({ payments });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ DAILY SALES ============

// POST /api/compliance/sales/daily - Create/update daily sales entry
router.post('/sales/daily', async (req, res) => {
  try {
    const { 
      sale_date, 
      batch_number,
      transaction_count,
      gross_sales, 
      taxable_sales, 
      non_taxable_sales,
      sales_tax_collected, 
      visa_amount,
      mastercard_amount,
      amex_amount,
      discover_amount,
      other_card_amount,
      check_amount,
      check_count,
      cash_amount,
      zelle_ach_amount,
      refunds, 
      tips,
      fees,
      net_deposit,
      no_sales,
      notes 
    } = req.body;
    
    if (!sale_date) {
      return res.status(400).json({ error: 'Sale date is required' });
    }
    
    // Upsert
    await db.runAsync(`
      INSERT INTO sales_daily_summary 
      (sale_date, batch_number, transaction_count, gross_sales, taxable_sales, non_taxable_sales, sales_tax_collected, 
       visa_amount, mastercard_amount, amex_amount, discover_amount, other_card_amount,
       check_amount, check_count, cash_amount, zelle_ach_amount,
       refunds, tips, fees, net_deposit, no_sales, notes, entered_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(sale_date) DO UPDATE SET
        batch_number = excluded.batch_number,
        transaction_count = excluded.transaction_count,
        gross_sales = excluded.gross_sales,
        taxable_sales = excluded.taxable_sales,
        non_taxable_sales = excluded.non_taxable_sales,
        sales_tax_collected = excluded.sales_tax_collected,
        visa_amount = excluded.visa_amount,
        mastercard_amount = excluded.mastercard_amount,
        amex_amount = excluded.amex_amount,
        discover_amount = excluded.discover_amount,
        other_card_amount = excluded.other_card_amount,
        check_amount = excluded.check_amount,
        check_count = excluded.check_count,
        cash_amount = excluded.cash_amount,
        zelle_ach_amount = excluded.zelle_ach_amount,
        refunds = excluded.refunds,
        tips = excluded.tips,
        fees = excluded.fees,
        net_deposit = excluded.net_deposit,
        no_sales = excluded.no_sales,
        notes = excluded.notes,
        entered_by = excluded.entered_by,
        updated_at = CURRENT_TIMESTAMP
    `, [
      sale_date,
      batch_number || null,
      transaction_count || 0,
      gross_sales || 0,
      taxable_sales || 0,
      non_taxable_sales || 0,
      sales_tax_collected || 0,
      visa_amount || 0,
      mastercard_amount || 0,
      amex_amount || 0,
      discover_amount || 0,
      other_card_amount || 0,
      check_amount || 0,
      check_count || 0,
      cash_amount || 0,
      zelle_ach_amount || 0,
      refunds || 0,
      tips || 0,
      fees || 0,
      net_deposit || 0,
      no_sales ? 1 : 0,
      notes || null,
      req.user.id
    ]);
    
    const entry = await db.getAsync(
      'SELECT * FROM sales_daily_summary WHERE sale_date = ?',
      [sale_date]
    );
    
    res.json({ entry, message: 'Daily sales recorded' });
  } catch (error) {
    console.error('Daily sales error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/compliance/sales/daily - Get daily sales entries
router.get('/sales/daily', async (req, res) => {
  try {
    const { start_date, end_date, limit } = req.query;
    
    let query = 'SELECT * FROM sales_daily_summary';
    const params = [];
    const conditions = [];
    
    if (start_date) {
      conditions.push('sale_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('sale_date <= ?');
      params.push(end_date);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY sale_date DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }
    
    const entries = await db.allAsync(query, params);
    
    res.json({ entries });
  } catch (error) {
    console.error('Get daily sales error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/compliance/sales/period-summary - Get period summary for tax calculation
router.get('/sales/period-summary', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates required' });
    }
    
    const summary = await db.getAsync(`
      SELECT 
        COUNT(*) as days_with_data,
        SUM(gross_sales) as total_gross_sales,
        SUM(taxable_sales) as total_taxable_sales,
        SUM(non_taxable_sales) as total_non_taxable_sales,
        SUM(sales_tax_collected) as total_sales_tax_collected,
        SUM(refunds) as total_refunds,
        SUM(tips) as total_tips,
        SUM(fees) as total_fees,
        SUM(net_deposit) as total_net_deposit,
        AVG(gross_sales) as avg_daily_sales
      FROM sales_daily_summary
      WHERE sale_date >= ? AND sale_date <= ?
    `, [start, end]);
    
    // Calculate expected days in period
    const startDate = new Date(start);
    const endDate = new Date(end);
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    res.json({ 
      summary: {
        ...summary,
        period_start: start,
        period_end: end,
        total_days: totalDays,
        missing_days: totalDays - (summary.days_with_data || 0)
      }
    });
  } catch (error) {
    console.error('Period summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ OBLIGATIONS CRUD ============

// GET /api/compliance/obligations
router.get('/obligations', async (req, res) => {
  try {
    const obligations = await db.allAsync(
      'SELECT * FROM compliance_obligations ORDER BY type, jurisdiction'
    );
    res.json({ obligations });
  } catch (error) {
    console.error('Get obligations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/compliance/obligations
router.post('/obligations', async (req, res) => {
  try {
    const { type, name, jurisdiction, frequency, due_day, due_rule_json, reminder_days_before, notes } = req.body;
    
    if (!type || !name || !frequency) {
      return res.status(400).json({ error: 'Type, name, and frequency are required' });
    }
    
    const result = await db.runAsync(`
      INSERT INTO compliance_obligations 
      (type, name, jurisdiction, frequency, due_day, due_rule_json, reminder_days_before, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [type, name, jurisdiction || 'custom', frequency, due_day, due_rule_json, reminder_days_before || 7, notes]);
    
    const obligation = await db.getAsync(
      'SELECT * FROM compliance_obligations WHERE id = ?',
      [result.lastID]
    );
    
    res.status(201).json({ obligation });
  } catch (error) {
    console.error('Create obligation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/compliance/obligations/:id
router.put('/obligations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, jurisdiction, frequency, due_day, due_rule_json, reminder_days_before, notes, enabled } = req.body;
    
    await db.runAsync(`
      UPDATE compliance_obligations SET
        name = COALESCE(?, name),
        jurisdiction = COALESCE(?, jurisdiction),
        frequency = COALESCE(?, frequency),
        due_day = COALESCE(?, due_day),
        due_rule_json = COALESCE(?, due_rule_json),
        reminder_days_before = COALESCE(?, reminder_days_before),
        notes = COALESCE(?, notes),
        enabled = COALESCE(?, enabled),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, jurisdiction, frequency, due_day, due_rule_json, reminder_days_before, notes, enabled !== undefined ? (enabled ? 1 : 0) : null, id]);
    
    const obligation = await db.getAsync(
      'SELECT * FROM compliance_obligations WHERE id = ?',
      [id]
    );
    
    res.json({ obligation });
  } catch (error) {
    console.error('Update obligation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/compliance/obligations/:id
router.delete('/obligations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Don't delete, just disable
    await db.runAsync(
      'UPDATE compliance_obligations SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    
    res.json({ message: 'Obligation disabled' });
  } catch (error) {
    console.error('Delete obligation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI REVIEW ============

// POST /api/compliance/ai/review - Get AI-powered compliance review
router.post('/ai/review', async (req, res) => {
  try {
    const aiEnabled = await isAIEnabled();
    if (!aiEnabled) {
      return res.status(400).json({ 
        error: 'AI is not configured. Set up Claude API key or local Ollama.',
        fallback: generateRuleBasedReview(req)
      });
    }
    
    // Gather compliance data
    const dashboard = await db.allAsync(`
      SELECT ci.*, co.name, co.type, co.jurisdiction
      FROM compliance_instances ci
      JOIN compliance_obligations co ON ci.obligation_id = co.id
      WHERE ci.due_date >= date('now', '-90 days')
      ORDER BY ci.due_date
    `);
    
    const salesSummary = await db.getAsync(`
      SELECT 
        SUM(gross_sales) as total_gross,
        SUM(taxable_sales) as total_taxable,
        SUM(sales_tax_collected) as total_tax_collected,
        COUNT(*) as days_entered
      FROM sales_daily_summary
      WHERE sale_date >= date('now', '-30 days')
    `);
    
    const overdue = dashboard.filter(i => i.status === 'overdue');
    const dueSoon = dashboard.filter(i => i.status === 'due_soon');
    
    const prompt = `You are a CPA assistant helping a small automotive service business in Texas. Review this compliance status and provide a checklist and any concerns.

CURRENT STATUS:
- Overdue items: ${overdue.length} (${overdue.map(o => `${o.name} for ${o.period_label}`).join(', ') || 'None'})
- Due soon items: ${dueSoon.length} (${dueSoon.map(d => `${d.name} due ${d.due_date}`).join(', ') || 'None'})

RECENT SALES (last 30 days):
- Days with data entered: ${salesSummary?.days_entered || 0}
- Total gross sales: $${(salesSummary?.total_gross || 0).toFixed(2)}
- Total taxable sales: $${(salesSummary?.total_taxable || 0).toFixed(2)}
- Total sales tax collected: $${(salesSummary?.total_tax_collected || 0).toFixed(2)}

Please provide:
1. A prioritized checklist of what needs attention NOW
2. Any concerns or anomalies you notice
3. Reminders for upcoming deadlines
4. Brief tips for staying compliant

Keep the response concise and actionable. Format as clear sections.

DISCLAIMER: This is AI-generated guidance, not professional tax advice. Always consult a licensed CPA for official tax matters.`;

    const response = await callClaude(prompt, {
      systemPrompt: 'You are a helpful CPA assistant. Be concise, practical, and always include a disclaimer that this is not professional tax advice.',
      maxTokens: 1500
    });
    
    res.json({ 
      review: response.text,
      generated_at: new Date().toISOString(),
      disclaimer: 'This is AI-generated guidance for informational purposes only. It is not professional tax, legal, or financial advice. Always consult a licensed CPA or tax professional for official tax matters.'
    });
  } catch (error) {
    console.error('AI review error:', error);
    res.status(500).json({ 
      error: 'AI review failed: ' + error.message,
      fallback: await generateRuleBasedReview()
    });
  }
});

// Rule-based fallback review
async function generateRuleBasedReview() {
  const overdue = await db.allAsync(`
    SELECT ci.*, co.name FROM compliance_instances ci
    JOIN compliance_obligations co ON ci.obligation_id = co.id
    WHERE ci.status = 'overdue'
  `);
  
  const dueSoon = await db.allAsync(`
    SELECT ci.*, co.name FROM compliance_instances ci
    JOIN compliance_obligations co ON ci.obligation_id = co.id
    WHERE ci.status = 'due_soon'
  `);
  
  let review = '## Compliance Checklist\n\n';
  
  if (overdue.length > 0) {
    review += '### 🚨 OVERDUE - Immediate Action Required\n';
    overdue.forEach(o => {
      review += `- **${o.name}** (${o.period_label}) - Was due ${o.due_date}\n`;
    });
    review += '\n';
  }
  
  if (dueSoon.length > 0) {
    review += '### ⚠️ Due Soon\n';
    dueSoon.forEach(d => {
      review += `- **${d.name}** (${d.period_label}) - Due ${d.due_date}\n`;
    });
    review += '\n';
  }
  
  if (overdue.length === 0 && dueSoon.length === 0) {
    review += '✅ All obligations are current!\n\n';
  }
  
  review += '---\n*This is a rule-based review. For AI-powered insights, configure Claude API or Ollama.*';
  
  return review;
}

// ============ EXPORT ============

// GET /api/compliance/export/cpa-packet - Export CPA packet as CSV data
router.get('/export/cpa-packet', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get sales summary
    const sales = await db.allAsync(`
      SELECT * FROM sales_daily_summary
      WHERE sale_date >= ? AND sale_date <= ?
      ORDER BY sale_date
    `, [start_date || '2020-01-01', end_date || '2099-12-31']);
    
    // Get payment history
    const payments = await db.allAsync(`
      SELECT cp.*, ci.period_label, co.name as obligation_name
      FROM compliance_payments cp
      JOIN compliance_instances ci ON cp.instance_id = ci.id
      JOIN compliance_obligations co ON ci.obligation_id = co.id
      WHERE cp.paid_at >= ? AND cp.paid_at <= ?
      ORDER BY cp.paid_at
    `, [start_date || '2020-01-01', end_date || '2099-12-31']);
    
    // Get instance summary
    const instances = await db.allAsync(`
      SELECT ci.*, co.name, co.type
      FROM compliance_instances ci
      JOIN compliance_obligations co ON ci.obligation_id = co.id
      WHERE ci.period_end >= ? AND ci.period_start <= ?
      ORDER BY ci.due_date
    `, [start_date || '2020-01-01', end_date || '2099-12-31']);
    
    res.json({
      period: { start: start_date, end: end_date },
      generated_at: new Date().toISOString(),
      sales_summary: sales,
      payments: payments,
      obligations: instances
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ BUSINESS EXPENSES ============

// POST /api/compliance/expenses - Create expense entry
router.post('/expenses', async (req, res) => {
  try {
    const { expense_name, category, amount, frequency, expense_date, week_ending_date, month_year, is_recurring, notes } = req.body;

    if (!expense_name || !category || !amount) {
      return res.status(400).json({ error: 'Expense name, category, and amount are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    // Validate frequency-specific date fields
    if (frequency === 'one_time' && !expense_date) {
      return res.status(400).json({ error: 'expense_date is required for one-time expenses' });
    }
    if (frequency === 'weekly' && !week_ending_date) {
      return res.status(400).json({ error: 'week_ending_date is required for weekly expenses' });
    }
    if (frequency === 'monthly' && !month_year) {
      return res.status(400).json({ error: 'month_year is required for monthly expenses (format: YYYY-MM)' });
    }

    await db.runAsync(`
      INSERT INTO business_expenses 
      (expense_name, category, amount, frequency, expense_date, week_ending_date, month_year, is_recurring, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      expense_name.trim(),
      category,
      parseFloat(amount),
      frequency || 'one_time',
      expense_date || null,
      week_ending_date || null,
      month_year || null,
      is_recurring ? 1 : 0,
      notes || null,
      req.user.id
    ]);

    const expense = await db.getAsync(
      'SELECT * FROM business_expenses WHERE id = (SELECT last_insert_rowid())'
    );

    res.status(201).json({ expense });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/compliance/expenses - Get expenses
router.get('/expenses', async (req, res) => {
  try {
    const { week_ending_date, category, start_date, end_date } = req.query;

    let query = 'SELECT be.*, u.full_name as created_by_name FROM business_expenses be LEFT JOIN users u ON be.created_by = u.id WHERE 1=1';
    const params = [];

    if (week_ending_date) {
      query += ' AND (week_ending_date = ? OR (expense_date >= DATE(?, "-6 days") AND expense_date <= ?))';
      params.push(week_ending_date, week_ending_date, week_ending_date);
    }

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (start_date && end_date) {
      query += ' AND (expense_date BETWEEN ? AND ? OR week_ending_date BETWEEN ? AND ?)';
      params.push(start_date, end_date, start_date, end_date);
    }

    query += ' ORDER BY expense_date DESC, week_ending_date DESC, created_at DESC';

    const expenses = await db.allAsync(query, params);
    res.json({ expenses });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/compliance/expenses/recurring - Get all recurring expenses
router.get('/expenses/recurring', async (req, res) => {
  try {
    const expenses = await db.allAsync(`
      SELECT be.*, u.full_name as created_by_name
      FROM business_expenses be
      LEFT JOIN users u ON be.created_by = u.id
      WHERE be.is_recurring = 1
      ORDER BY be.category, be.expense_name
    `);
    res.json({ expenses });
  } catch (error) {
    console.error('Get recurring expenses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/compliance/expenses/:id - Update expense
router.put('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { expense_name, category, amount, frequency, expense_date, week_ending_date, month_year, is_recurring, notes } = req.body;

    const existing = await db.getAsync('SELECT * FROM business_expenses WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    await db.runAsync(`
      UPDATE business_expenses
      SET expense_name = ?,
          category = ?,
          amount = ?,
          frequency = ?,
          expense_date = ?,
          week_ending_date = ?,
          month_year = ?,
          is_recurring = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      expense_name !== undefined ? expense_name.trim() : existing.expense_name,
      category !== undefined ? category : existing.category,
      amount !== undefined ? parseFloat(amount) : existing.amount,
      frequency !== undefined ? frequency : existing.frequency,
      expense_date !== undefined ? expense_date : existing.expense_date,
      week_ending_date !== undefined ? week_ending_date : existing.week_ending_date,
      month_year !== undefined ? month_year : existing.month_year,
      is_recurring !== undefined ? (is_recurring ? 1 : 0) : existing.is_recurring,
      notes !== undefined ? notes : existing.notes,
      id
    ]);

    const updated = await db.getAsync('SELECT be.*, u.full_name as created_by_name FROM business_expenses be LEFT JOIN users u ON be.created_by = u.id WHERE be.id = ?', [id]);
    res.json({ expense: updated });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/compliance/expenses/:id - Delete expense
router.delete('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM business_expenses WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ PROFIT & LOSS ============
// All week boundaries and dates use Houston (America/Chicago) via appTimezone.js

function getWeekStart(weekEndingDate) {
  return getWeekStartHouston(weekEndingDate);
}

function getWeekEndingFriday(date) {
  return getWeekEndingFridayHouston(date);
}

// Helper function to calculate weekly payroll
async function calculateWeeklyPayroll(weekStart, weekEnd) {
  const employees = await db.allAsync(`
    SELECT id, full_name, weekly_salary, hourly_rate, split_reimbursable_amount, split_reimbursable_notes, split_reimbursable_period
    FROM users
    WHERE is_active = 1
  `);

  const payroll = [];
  let totalPayroll = 0;

  for (const employee of employees) {
    let employeeCost = 0;
    let hoursWorked = null;
    let timeEntries = null;

    if (employee.weekly_salary && employee.weekly_salary > 0) {
      // Use weekly salary directly
      employeeCost = parseFloat(employee.weekly_salary);
    } else if (employee.hourly_rate && employee.hourly_rate > 0) {
      // Calculate from time entries
      timeEntries = await db.allAsync(`
        SELECT clock_in, clock_out, break_minutes
        FROM time_entries
        WHERE user_id = ?
          AND DATE(clock_in) >= ?
          AND DATE(clock_in) <= ?
          AND clock_out IS NOT NULL
      `, [employee.id, weekStart, weekEnd]);

      let totalHours = 0;
      for (const entry of timeEntries) {
        const clockIn = new Date(entry.clock_in);
        const clockOut = new Date(entry.clock_out);
        const hours = (clockOut - clockIn) / (1000 * 60 * 60) - (entry.break_minutes || 0) / 60;
        totalHours += Math.max(0, hours);
      }

      hoursWorked = totalHours;
      employeeCost = totalHours * parseFloat(employee.hourly_rate);
    }

    if (employeeCost > 0) {
      payroll.push({
        employee_id: employee.id,
        payroll_people_id: null,
        employee_name: employee.full_name,
        weekly_salary: employee.weekly_salary || 0,
        hourly_rate: employee.hourly_rate || 0,
        hours_worked: hoursWorked,
        cost: employeeCost,
        split_reimbursable_amount: parseFloat(employee.split_reimbursable_amount) || 0,
        split_reimbursable_notes: employee.split_reimbursable_notes || null,
        split_reimbursable_period: employee.split_reimbursable_period || 'weekly'
      });
      totalPayroll += employeeCost;
    }
  }

  // Payroll-only people (contractors, etc.) — fixed weekly salary per week
  const payrollPeople = await db.allAsync(
    'SELECT id, full_name, weekly_salary, split_reimbursable_amount, split_reimbursable_notes, split_reimbursable_period FROM payroll_people WHERE is_active = 1 AND weekly_salary > 0'
  );
  for (const p of payrollPeople) {
    const cost = parseFloat(p.weekly_salary) || 0;
    if (cost > 0) {
      payroll.push({
        employee_id: null,
        payroll_people_id: p.id,
        employee_name: p.full_name,
        weekly_salary: cost,
        hourly_rate: 0,
        hours_worked: null,
        cost,
        split_reimbursable_amount: parseFloat(p.split_reimbursable_amount) || 0,
        split_reimbursable_notes: p.split_reimbursable_notes || null,
        split_reimbursable_period: p.split_reimbursable_period || 'weekly'
      });
      totalPayroll += cost;
    }
  }

  return { payroll, totalPayroll };
}

// Helper function to calculate weekly expenses
async function calculateWeeklyExpenses(weekStart, weekEnd, weekEndingDate) {
  // Get one-time expenses for the week
  const oneTimeExpenses = await db.allAsync(`
    SELECT * FROM business_expenses
    WHERE frequency = 'one_time'
      AND expense_date >= ?
      AND expense_date <= ?
  `, [weekStart, weekEnd]);

  // Get weekly expenses for this week
  const weeklyExpenses = await db.allAsync(`
    SELECT * FROM business_expenses
    WHERE frequency = 'weekly'
      AND week_ending_date = ?
  `, [weekEndingDate]);

  // Get monthly expenses - need to check if week falls in that month
  const monthYear = weekEnd.substring(0, 7); // YYYY-MM format
  const monthlyExpenses = await db.allAsync(`
    SELECT * FROM business_expenses
    WHERE frequency = 'monthly'
      AND month_year = ?
  `, [monthYear]);

  // Prorate monthly expenses (divide by 4.33 weeks per month)
  // Keep original amount intact, add prorated_amount as separate field
  const proratedMonthly = monthlyExpenses.map(e => ({
    ...e,
    amount: parseFloat(e.amount), // Keep original monthly amount
    prorated_amount: parseFloat(e.amount) / 4.33
  }));

  const allExpenses = [
    ...oneTimeExpenses.map(e => ({ ...e, amount: parseFloat(e.amount) })),
    ...weeklyExpenses.map(e => ({ ...e, amount: parseFloat(e.amount) })),
    ...proratedMonthly // Keep original amount, prorated_amount is separate
  ];

  // Group by category
  const byCategory = {};
  let totalExpenses = 0;

  for (const expense of allExpenses) {
    if (!byCategory[expense.category]) {
      byCategory[expense.category] = [];
    }
    byCategory[expense.category].push(expense);
    // For monthly expenses, use prorated_amount for weekly totals
    // For other expenses, use the regular amount
    const amountToAdd = expense.prorated_amount !== undefined ? expense.prorated_amount : expense.amount;
    totalExpenses += amountToAdd;
  }

  return { expenses: allExpenses, byCategory, totalExpenses };
}

// In-memory cache for weekly P&L so dashboard polling returns the same number (avoids glitchy flips)
const pnlWeeklyCache = new Map();
const PNL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedPnlWeekly(weekEndDate) {
  const entry = pnlWeeklyCache.get(weekEndDate);
  if (!entry) return null;
  if (Date.now() - entry.at > PNL_CACHE_TTL_MS) {
    pnlWeeklyCache.delete(weekEndDate);
    return null;
  }
  return entry.payload;
}

function setCachedPnlWeekly(weekEndDate, payload) {
  pnlWeeklyCache.set(weekEndDate, { payload, at: Date.now() });
}

// GET /api/compliance/pnl/weekly - Get weekly P&L report
router.get('/pnl/weekly', async (req, res) => {
  try {
    const { week_ending_date } = req.query;

    if (!week_ending_date) {
      return res.status(400).json({ error: 'week_ending_date is required (Friday date)' });
    }

    // Auto-adjust to Friday if not already a Friday (business week ends Friday)
    const weekEndDate = getWeekEndingFriday(week_ending_date);
    const weekStart = getWeekStart(weekEndDate);

    const cached = getCachedPnlWeekly(weekEndDate);
    if (cached) {
      return res.json(cached);
    }

    // Revenue: one source per day — Shop Monkey > processor_daily_revenue > manual (never sum two for same day)
    const salesData = await db.allAsync(`
      SELECT sale_date, gross_sales, check_amount, cash_amount, zelle_ach_amount, net_deposit
      FROM sales_daily_summary
      WHERE sale_date >= ? AND sale_date <= ?
      ORDER BY sale_date ASC
    `, [weekStart, weekEndDate]);

    const smRevenueRows = await db.allAsync(`
      SELECT date, revenue FROM shopmonkey_daily_revenue
      WHERE date >= ? AND date <= ?
    `, [weekStart, weekEndDate]).catch(() => []);
    const smByDate = {};
    for (const r of (smRevenueRows || [])) { smByDate[r.date] = parseFloat(r.revenue) || 0; }

    const procRows = await db.allAsync(
      'SELECT date, SUM(revenue) as revenue FROM processor_daily_revenue WHERE date >= ? AND date <= ? GROUP BY date',
      [weekStart, weekEndDate]
    ).catch(() => []);
    const procByDate = {};
    for (const r of (procRows || [])) { procByDate[r.date] = parseFloat(r.revenue) || 0; }

    const manualByDate = {};
    for (const s of salesData) {
      const cc = parseFloat(s.gross_sales) || 0;
      const ck = parseFloat(s.check_amount) || 0;
      const ca = parseFloat(s.cash_amount) || 0;
      const za = parseFloat(s.zelle_ach_amount) || 0;
      manualByDate[s.sale_date] = { revenue: cc + ck + ca + za, credit_cards: cc, checks: ck, cash: ca, zelle_ach: za, net_deposit: parseFloat(s.net_deposit) || 0 };
    }

    const allDates = [...new Set([...Object.keys(smByDate), ...Object.keys(procByDate), ...Object.keys(manualByDate)])].sort();
    const dailySales = allDates.map(date => {
      if (smByDate[date] !== undefined) {
        return { date, revenue: smByDate[date], source: 'shopmonkey' };
      }
      if (procByDate[date] !== undefined) {
        return { date, revenue: procByDate[date], source: 'processor' };
      }
      const m = manualByDate[date];
      return { date, revenue: m.revenue, source: 'manual', credit_cards: m.credit_cards, checks: m.checks, cash: m.cash, zelle_ach: m.zelle_ach, net_deposit: m.net_deposit };
    });

    const totalRevenue = dailySales.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0);

    // Calculate Payroll
    const { payroll, totalPayroll } = await calculateWeeklyPayroll(weekStart, weekEndDate);

    // Calculate Expenses
    const { expenses, byCategory, totalExpenses } = await calculateWeeklyExpenses(weekStart, weekEndDate, weekEndDate);

    // Calculate Net Profit/Loss
    const netProfitLoss = totalRevenue - totalPayroll - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfitLoss / totalRevenue) * 100 : 0;

    // Get previous week for comparison (previous Friday) in Houston
    const prevWeekEnd = addDaysInHouston(weekEndDate, -7);
    const prevWeekStart = getWeekStart(prevWeekEnd);

    // Previous week revenue (same merged logic: SM > processor > manual)
    const prevManualSales = await db.allAsync(`
      SELECT sale_date,
        (COALESCE(gross_sales,0) + COALESCE(check_amount,0) + COALESCE(cash_amount,0) + COALESCE(zelle_ach_amount,0)) as total
      FROM sales_daily_summary WHERE sale_date >= ? AND sale_date <= ?
    `, [prevWeekStart, prevWeekEnd]);
    const prevSmRevenue = await db.allAsync(
      'SELECT date, revenue FROM shopmonkey_daily_revenue WHERE date >= ? AND date <= ?',
      [prevWeekStart, prevWeekEnd]
    ).catch(() => []);
    const prevProcRevenue = await db.allAsync(
      'SELECT date, SUM(revenue) as revenue FROM processor_daily_revenue WHERE date >= ? AND date <= ? GROUP BY date',
      [prevWeekStart, prevWeekEnd]
    ).catch(() => []);
    const prevSmByDate = {};
    for (const r of (prevSmRevenue || [])) { prevSmByDate[r.date] = parseFloat(r.revenue) || 0; }
    const prevProcByDate = {};
    for (const r of (prevProcRevenue || [])) { prevProcByDate[r.date] = parseFloat(r.revenue) || 0; }
    const prevManualByDate = {};
    for (const s of prevManualSales) { prevManualByDate[s.sale_date] = parseFloat(s.total) || 0; }
    const prevAllDates = [...new Set([...Object.keys(prevSmByDate), ...Object.keys(prevProcByDate), ...Object.keys(prevManualByDate)])];
    let prevRevenue = 0;
    for (const date of prevAllDates) {
      const rev = prevSmByDate[date] !== undefined ? prevSmByDate[date] : (prevProcByDate[date] !== undefined ? prevProcByDate[date] : (prevManualByDate[date] || 0));
      prevRevenue += rev;
    }

    // Bank-sourced business expenses for this week
    const bankExpenses = await db.getAsync(
      'SELECT COALESCE(SUM(amount), 0) as total FROM bank_transactions WHERE date >= ? AND date <= ? AND is_business_expense = 1 AND amount > 0',
      [weekStart, weekEndDate]
    ).catch(() => ({ total: 0 }));
    const bankExpenseTotal = parseFloat(bankExpenses?.total || 0);

    const prevPayroll = await calculateWeeklyPayroll(prevWeekStart, prevWeekEnd);
    const prevExpenses = await calculateWeeklyExpenses(prevWeekStart, prevWeekEnd, prevWeekEnd);
    
    const prevNet = prevRevenue - prevPayroll.totalPayroll - prevExpenses.totalExpenses;
    const comparison = prevNet !== 0 ? ((netProfitLoss - prevNet) / Math.abs(prevNet)) * 100 : 0;

    const payload = {
      week_ending_date: weekEndDate,
      week_start: weekStart,
      revenue: {
        total: totalRevenue,
        daily: dailySales,
        missing_days: getMissingDays(weekStart, weekEndDate, dailySales.map(d => d.date))
      },
      payroll: {
        total: totalPayroll,
        employees: payroll
      },
      expenses: {
        total: totalExpenses,
        by_category: byCategory,
        items: expenses
      },
      bank_expenses: {
        total: bankExpenseTotal,
      },
      summary: {
        total_revenue: totalRevenue,
        total_expenses: totalPayroll + totalExpenses + bankExpenseTotal,
        payroll_cost: totalPayroll,
        other_expenses: totalExpenses,
        bank_expenses: bankExpenseTotal,
        net_profit_loss: totalRevenue - totalPayroll - totalExpenses - bankExpenseTotal,
        profit_margin: totalRevenue > 0 ? ((totalRevenue - totalPayroll - totalExpenses - bankExpenseTotal) / totalRevenue) * 100 : 0,
        is_profitable: (totalRevenue - totalPayroll - totalExpenses - bankExpenseTotal) > 0
      },
      comparison: {
        previous_week_net: prevNet,
        change_amount: netProfitLoss - prevNet,
        change_percentage: comparison
      }
    };
    setCachedPnlWeekly(weekEndDate, payload);
    res.json(payload);
  } catch (error) {
    console.error('Get weekly P&L error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper to find missing days in sales data (Houston date strings YYYY-MM-DD)
function getMissingDays(weekStart, weekEnd, existingDates) {
  const missing = [];
  const set = new Set(existingDates || []);
  let current = weekStart;
  while (current <= weekEnd) {
    if (!set.has(current)) missing.push(current);
    current = addDaysInHouston(current, 1);
  }
  return missing;
}

// GET /api/compliance/pnl/weeks - Get multiple weeks for comparison
router.get('/pnl/weeks', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Generate all Fridays between start and end (business weeks)
    const weeks = [];
    const start = new Date(start_date);
    const end = new Date(end_date);
    
    // Find first Friday
    let current = new Date(start);
    while (current.getDay() !== 5 && current <= end) {
      current.setDate(current.getDate() + 1);
    }

    while (current <= end) {
      const weekEnd = current.toISOString().split('T')[0];
      const weekStart = getWeekStart(weekEnd);

      // Quick summary for each week
      const sales = await db.allAsync(`
        SELECT 
          SUM(gross_sales + COALESCE(check_amount, 0) + COALESCE(cash_amount, 0) + COALESCE(zelle_ach_amount, 0)) as total 
        FROM sales_daily_summary
        WHERE sale_date >= ? AND sale_date <= ?
      `, [weekStart, weekEnd]);
      
      const payroll = await calculateWeeklyPayroll(weekStart, weekEnd);
      const expenses = await calculateWeeklyExpenses(weekStart, weekEnd, weekEnd);
      
      const revenue = parseFloat(sales[0]?.total || 0);
      const net = revenue - payroll.totalPayroll - expenses.totalExpenses;

      weeks.push({
        week_ending_date: weekEnd,
        week_start: weekStart,
        revenue,
        payroll: payroll.totalPayroll,
        expenses: expenses.totalExpenses,
        net_profit_loss: net
      });

      // Move to next Friday
      current.setDate(current.getDate() + 7);
    }

    res.json({ weeks });
  } catch (error) {
    console.error('Get weeks P&L error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
