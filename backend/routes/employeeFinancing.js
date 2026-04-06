import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function validateDeductionReason(deductFromPayroll, reason) {
  if (!deductFromPayroll) return true;
  return typeof reason === 'string' && reason.trim().length > 0;
}

/** Either a Spectrum user id OR external person / other business — not both. */
function parsePayee(body) {
  const extName = (body.external_party_name || '').trim();
  const extCo = (body.external_party_company || '').trim();
  const rawUid = body.user_id;
  const uid =
    rawUid === null || rawUid === undefined || rawUid === ''
      ? NaN
      : parseInt(String(rawUid), 10);
  if (!Number.isNaN(uid) && uid > 0) {
    return {
      kind: 'employee',
      user_id: uid,
      external_party_name: null,
      external_party_company: null
    };
  }
  if (extName.length > 0) {
    return {
      kind: 'external',
      user_id: null,
      external_party_name: extName,
      external_party_company: extCo || null
    };
  }
  return { kind: 'invalid' };
}

function enrichFinancingRow(r) {
  if (!r) return r;
  if (r.user_id != null) {
    r.payer_display = r.employee_name || r.employee_username || `User #${r.user_id}`;
  } else {
    const co =
      r.external_party_company && String(r.external_party_company).trim()
        ? ` (${String(r.external_party_company).trim()})`
        : '';
    r.payer_display = (r.external_party_name || 'External payer') + co;
  }
  return r;
}

const SELECT_PLAN = `
  SELECT f.*, u.full_name AS employee_name, u.username AS employee_username
  FROM employee_shop_financing f
  LEFT JOIN users u ON u.id = f.user_id
`;

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `${SELECT_PLAN}`;
    const params = [];
    if (status && ['active', 'paid_off', 'paused'].includes(status)) {
      sql += ' WHERE f.status = ?';
      params.push(status);
    }
    sql +=
      ' ORDER BY LOWER(COALESCE(u.full_name, f.external_party_name, \'\')) ASC, f.created_at DESC';
    const rows = await db.allAsync(sql, params);
    res.json({ plans: rows.map(enrichFinancingRow) });
  } catch (e) {
    console.error('List employee financing error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/deductions', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const rows = await db.allAsync(
      `SELECT d.*, u.full_name AS applied_by_name
       FROM employee_shop_financing_deductions d
       LEFT JOIN users u ON u.id = d.applied_by
       WHERE d.financing_id = ?
       ORDER BY d.week_ending_date DESC, d.id DESC`,
      [id]
    );
    res.json({ deductions: rows });
  } catch (e) {
    console.error('List deductions error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      item_description,
      total_amount,
      balance_due,
      weekly_payment,
      deduct_from_payroll,
      deduction_reason,
      notes,
      start_date,
      status
    } = req.body || {};

    const payee = parsePayee(req.body || {});
    if (payee.kind === 'invalid') {
      return res.status(400).json({
        error: 'Choose a Spectrum employee or enter an external payer name (another business, contractor, etc.).'
      });
    }

    const desc = (item_description || '').trim();
    if (!desc) return res.status(400).json({ error: 'Item / description is required' });

    const total = roundMoney(total_amount);
    if (total <= 0) return res.status(400).json({ error: 'Total amount must be greater than 0' });

    const balance = balance_due != null ? roundMoney(balance_due) : total;
    if (balance < 0 || balance > total) {
      return res.status(400).json({ error: 'Balance due must be between 0 and total amount' });
    }

    const weekly = roundMoney(weekly_payment);
    if (weekly < 0) return res.status(400).json({ error: 'Weekly payment cannot be negative' });

    const deduct = deduct_from_payroll ? 1 : 0;
    const reason = (deduction_reason || '').trim();
    if (!validateDeductionReason(deduct, reason)) {
      return res.status(400).json({
        error: 'When deducting from payroll, a deduction reason is required (shows on payroll records).'
      });
    }

    const st = status && ['active', 'paid_off', 'paused'].includes(status) ? status : 'active';

    if (payee.kind === 'employee') {
      const userRow = await db.getAsync('SELECT id FROM users WHERE id = ? AND is_active = 1', [
        payee.user_id
      ]);
      if (!userRow) return res.status(400).json({ error: 'Employee not found or inactive' });
    }

    const result = await db.runAsync(
      `INSERT INTO employee_shop_financing (
        user_id, external_party_name, external_party_company,
        item_description, total_amount, balance_due, weekly_payment,
        deduct_from_payroll, deduction_reason, status, notes, start_date, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payee.user_id,
        payee.external_party_name,
        payee.external_party_company,
        desc,
        total,
        balance,
        weekly,
        deduct,
        deduct ? reason : null,
        st,
        (notes || '').trim() || null,
        start_date || null,
        req.user.id
      ]
    );

    const row = await db.getAsync(`${SELECT_PLAN} WHERE f.id = ?`, [result.lastID]);
    res.status(201).json({ plan: enrichFinancingRow(row) });
  } catch (e) {
    console.error('Create employee financing error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.getAsync('SELECT * FROM employee_shop_financing WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Plan not found' });

    const {
      item_description,
      total_amount,
      balance_due,
      weekly_payment,
      deduct_from_payroll,
      deduction_reason,
      notes,
      start_date,
      status,
      user_id,
      external_party_name,
      external_party_company
    } = req.body || {};

    const desc = item_description !== undefined ? String(item_description).trim() : existing.item_description;
    if (!desc) return res.status(400).json({ error: 'Item / description is required' });

    const total = total_amount != null ? roundMoney(total_amount) : existing.total_amount;
    const balance = balance_due != null ? roundMoney(balance_due) : existing.balance_due;
    const weekly = weekly_payment != null ? roundMoney(weekly_payment) : existing.weekly_payment;
    const deduct = deduct_from_payroll !== undefined ? (deduct_from_payroll ? 1 : 0) : existing.deduct_from_payroll;
    let reason =
      deduction_reason !== undefined ? String(deduction_reason).trim() : existing.deduction_reason || '';
    if (!validateDeductionReason(deduct, reason)) {
      return res.status(400).json({
        error: 'When deducting from payroll, a deduction reason is required (shows on payroll records).'
      });
    }

    const st = status && ['active', 'paid_off', 'paused'].includes(status) ? status : existing.status;
    const notesVal = notes !== undefined ? (String(notes).trim() || null) : existing.notes;
    const startVal = start_date !== undefined ? start_date || null : existing.start_date;

    if (total <= 0) return res.status(400).json({ error: 'Total amount must be greater than 0' });
    if (balance < 0 || balance > total) {
      return res.status(400).json({ error: 'Balance due must be between 0 and total amount' });
    }
    if (weekly < 0) return res.status(400).json({ error: 'Weekly payment cannot be negative' });

    let payee;
    if (user_id !== undefined || external_party_name !== undefined || external_party_company !== undefined) {
      const merged = {
        user_id: user_id !== undefined ? user_id : existing.user_id,
        external_party_name:
          external_party_name !== undefined ? external_party_name : existing.external_party_name,
        external_party_company:
          external_party_company !== undefined ? external_party_company : existing.external_party_company
      };
      if (user_id !== undefined && (user_id === null || user_id === '')) {
        merged.user_id = null;
      }
      payee = parsePayee(merged);
      if (payee.kind === 'invalid') {
        return res.status(400).json({
          error: 'Choose a Spectrum employee or enter an external payer name.'
        });
      }
    } else {
      if (existing.user_id != null) {
        payee = {
          kind: 'employee',
          user_id: existing.user_id,
          external_party_name: null,
          external_party_company: null
        };
      } else {
        payee = {
          kind: 'external',
          user_id: null,
          external_party_name: existing.external_party_name,
          external_party_company: existing.external_party_company
        };
      }
    }

    if (payee.kind === 'employee') {
      const userRow = await db.getAsync('SELECT id FROM users WHERE id = ? AND is_active = 1', [
        payee.user_id
      ]);
      if (!userRow) return res.status(400).json({ error: 'Employee not found or inactive' });
    }

    await db.runAsync(
      `UPDATE employee_shop_financing SET
        user_id = ?, external_party_name = ?, external_party_company = ?,
        item_description = ?, total_amount = ?, balance_due = ?, weekly_payment = ?,
        deduct_from_payroll = ?, deduction_reason = ?, status = ?, notes = ?, start_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        payee.user_id,
        payee.external_party_name,
        payee.external_party_company,
        desc,
        total,
        balance,
        weekly,
        deduct,
        deduct ? reason : null,
        st,
        notesVal,
        startVal,
        id
      ]
    );

    const row = await db.getAsync(`${SELECT_PLAN} WHERE f.id = ?`, [id]);
    res.json({ plan: enrichFinancingRow(row) });
  } catch (e) {
    console.error('Update employee financing error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/record-deduction', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const { week_ending_date, amount, extra_note } = req.body || {};
    const week = (week_ending_date || '').trim();
    if (!week) return res.status(400).json({ error: 'week_ending_date is required (e.g. pay week ending Friday)' });

    const plan = await db.getAsync('SELECT * FROM employee_shop_financing WHERE id = ?', [id]);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.status !== 'active') {
      return res.status(400).json({ error: 'Only active plans can receive deductions' });
    }

    const bal = roundMoney(plan.balance_due);
    if (bal <= 0) return res.status(400).json({ error: 'Balance is already zero' });

    const dup = await db.getAsync(
      'SELECT id FROM employee_shop_financing_deductions WHERE financing_id = ? AND week_ending_date = ?',
      [id, week]
    );
    if (dup) {
      return res.status(400).json({
        error: `A deduction for week ending ${week} already exists for this plan.`
      });
    }

    let payAmount = amount != null ? roundMoney(amount) : roundMoney(plan.weekly_payment);
    if (payAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    payAmount = Math.min(payAmount, bal);

    const baseReason = (plan.deduction_reason || '').trim() || 'Shop financing repayment';
    const extra = (extra_note || '').trim();
    const reasonNote = extra ? `${baseReason} — ${extra}` : baseReason;

    await db.runAsync(
      `INSERT INTO employee_shop_financing_deductions (financing_id, week_ending_date, amount, reason_note, applied_by)
       VALUES (?, ?, ?, ?, ?)`,
      [id, week, payAmount, reasonNote, req.user.id]
    );

    const newBal = roundMoney(bal - payAmount);
    const newStatus = newBal <= 0 ? 'paid_off' : 'active';

    await db.runAsync(
      `UPDATE employee_shop_financing SET balance_due = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newBal, newStatus, id]
    );

    const row = await db.getAsync(`${SELECT_PLAN} WHERE f.id = ?`, [id]);

    res.json({
      plan: enrichFinancingRow(row),
      deduction: { week_ending_date: week, amount: payAmount, reason_note: reasonNote }
    });
  } catch (e) {
    console.error('Record financing deduction error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
