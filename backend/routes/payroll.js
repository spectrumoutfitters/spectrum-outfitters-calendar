import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin, requirePayrollAccess, requireMasterAdmin } from '../middleware/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { getPayrollDataPath } from '../utils/payrollDataPath.js';
import { loadMergedPayrollHistory, mergeImportPayrollHistory } from '../utils/payrollHistoryRecords.js';
import {
  payrollAccessFlags,
  payrollAccessRevokeBlock,
  isSafePayrollDataFilename,
  payrollEmployeeLookupKey,
  calendarEmployeeLookupKey,
  mergeCalendarPayrollEmployee,
  payrollWeekBoundsFromEndingDate,
  mapPayrollTimeEntry,
  groupPayrollTimeByUser,
  payrollHistoryInDateRange,
  sumPayrollHistoryTotals,
} from '../utils/payrollSyncMath.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/payroll/access - Check if user has payroll access
router.get('/access', async (req, res) => {
  try {
    const user = await db.getAsync(
      'SELECT id, username, full_name, role, payroll_access, is_master_admin FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(payrollAccessFlags(user));
  } catch (error) {
    console.error('Check payroll access error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payroll/admins - Get all admins with payroll access status (master admin only)
router.get('/admins', requireMasterAdmin, async (req, res) => {
  try {
    const admins = await db.allAsync(`
      SELECT id, username, full_name, email, role, payroll_access, is_master_admin, is_active
      FROM users
      WHERE role = 'admin'
      ORDER BY is_master_admin DESC, full_name ASC
    `);

    res.json({ admins });
  } catch (error) {
    console.error('Get payroll admins error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/payroll/admins/:id/access - Toggle payroll access for an admin (master admin only)
router.put('/admins/:id/access', requireMasterAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { payroll_access } = req.body;

    const targetUser = await db.getAsync('SELECT is_master_admin FROM users WHERE id = ?', [id]);
    const revokeBlock = payrollAccessRevokeBlock({
      targetIsMasterAdmin: !!(targetUser && targetUser.is_master_admin === 1),
      actorId: req.user.id,
      targetId: id,
      payroll_access,
    });
    if (revokeBlock.blocked) {
      return res.status(400).json({ error: revokeBlock.error });
    }

    await db.runAsync(
      'UPDATE users SET payroll_access = ? WHERE id = ? AND role = ?',
      [payroll_access ? 1 : 0, id, 'admin']
    );

    const updatedUser = await db.getAsync(
      'SELECT id, username, full_name, payroll_access FROM users WHERE id = ?',
      [id]
    );

    res.json({ 
      user: updatedUser,
      message: `Payroll access ${payroll_access ? 'granted' : 'revoked'} successfully`
    });
  } catch (error) {
    console.error('Toggle payroll access error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payroll/path - Get payroll system path (for integration)
router.get('/path', requirePayrollAccess, (req, res) => {
  try {
    const payrollPath = path.join(
      path.dirname(__dirname),
      '..',
      '..',
      'Payroll System',
      'index.html'
    );
    
    res.json({ 
      path: payrollPath,
      url: '/payroll-system/index.html', // Relative path for serving
      dataPath: getPayrollDataPath() // Return data path for reference
    });
  } catch (error) {
    console.error('Get payroll path error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payroll/data/:filename - Read payroll data file
router.get('/data/:filename', requirePayrollAccess, (req, res) => {
  try {
    const { filename } = req.params;
    if (!isSafePayrollDataFilename(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const dataPath = getPayrollDataPath();
    const filePath = path.join(dataPath, filename);

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      res.json({ success: true, data });
    } else {
      res.json({ success: false, error: 'File not found' });
    }
  } catch (error) {
    console.error('Read payroll file error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/payroll/data/:filename - Write payroll data file
router.post('/data/:filename', requirePayrollAccess, (req, res) => {
  try {
    const { filename } = req.params;
    const { data } = req.body;
    
    if (!isSafePayrollDataFilename(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (data === undefined || data === null) {
      return res.status(400).json({ error: 'Data is required' });
    }
    const dataPath = getPayrollDataPath();
    const filePath = path.join(dataPath, filename);
    const toWrite = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, toWrite, 'utf8');
    res.json({ success: true });
  } catch (error) {
    console.error('Write payroll file error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/payroll/data-path - Get the data path (for display)
router.get('/data-path', requirePayrollAccess, (req, res) => {
  try {
    const dataPath = getPayrollDataPath();
    res.json({ success: true, path: dataPath });
  } catch (error) {
    console.error('Get data path error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const VAULT_META_FILENAME = 'vault-meta.json';

// GET /api/payroll/vault-meta - Get salt and verifier for E2E (client checks passphrase locally)
router.get('/vault-meta', requirePayrollAccess, (req, res) => {
  try {
    const dataPath = getPayrollDataPath();
    const filePath = path.join(dataPath, VAULT_META_FILENAME);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, initialized: false });
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const meta = JSON.parse(raw);
    if (!meta.salt || !meta.verifier) {
      return res.status(404).json({ success: false, initialized: false });
    }
    res.json({ success: true, initialized: true, salt: meta.salt, verifier: meta.verifier });
  } catch (error) {
    console.error('Get vault-meta error:', error);
    res.status(404).json({ success: false, initialized: false });
  }
});

// POST /api/payroll/vault-meta - Set salt and verifier (first-time E2E setup)
router.post('/vault-meta', requirePayrollAccess, (req, res) => {
  try {
    const { salt, verifier } = req.body;
    if (typeof salt !== 'string' || typeof verifier !== 'string') {
      return res.status(400).json({ error: 'salt and verifier (base64 strings) required' });
    }
    const dataPath = getPayrollDataPath();
    const filePath = path.join(dataPath, VAULT_META_FILENAME);
    fs.writeFileSync(filePath, JSON.stringify({ salt, verifier }, null, 2), 'utf8');
    res.json({ success: true });
  } catch (error) {
    console.error('Post vault-meta error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/payroll/sync/employees - Sync employees from Calendar system to payroll
router.get('/sync/employees', requirePayrollAccess, async (req, res) => {
  try {
    const calendarEmployees = await db.allAsync(
      'SELECT id, full_name, username, email, hourly_rate, weekly_salary, role FROM users WHERE is_active = 1 AND role IN (?, ?) ORDER BY full_name',
      ['employee', 'admin']
    );

    // Read existing payroll employees (may be encrypted when E2E is used; then we skip merge)
    const dataPath = getPayrollDataPath();
    const payrollEmployeesPath = path.join(dataPath, 'employees.json');
    let payrollEmployees = [];
    if (fs.existsSync(payrollEmployeesPath)) {
      try {
        const data = fs.readFileSync(payrollEmployeesPath, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          payrollEmployees = parsed;
        }
      } catch (_) {
        // Encrypted or invalid: cannot merge server-side; client will merge with decrypted data
      }
    }

    // Create a map of existing payroll employees by name/username
    const payrollMap = new Map();
    payrollEmployees.forEach(emp => {
      const key = payrollEmployeeLookupKey(emp);
      payrollMap.set(key, emp);
    });

    const syncedEmployees = calendarEmployees.map(calEmp => {
      const key = calendarEmployeeLookupKey(calEmp);
      const existingPayroll = payrollMap.get(key);
      return mergeCalendarPayrollEmployee(calEmp, existingPayroll);
    });

    res.json({ 
      success: true, 
      employees: syncedEmployees,
      synced: syncedEmployees.length,
      existing: payrollEmployees.length
    });
  } catch (error) {
    console.error('Sync employees error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/payroll/sync/time-entries - Get time entries for payroll period
router.get('/sync/time-entries', requirePayrollAccess, async (req, res) => {
  try {
    const { week_ending_date, user_id } = req.query;
    
    if (!week_ending_date) {
      return res.status(400).json({ error: 'week_ending_date is required' });
    }

    const { weekStart, weekEndDate } = payrollWeekBoundsFromEndingDate(week_ending_date);

    // Get time entries for the week (Monday to Sunday)
    let query = `
      SELECT 
        te.*,
        u.full_name,
        u.username,
        u.hourly_rate,
        u.weekly_salary
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE DATE(te.clock_in) >= DATE(?)
        AND DATE(te.clock_in) <= DATE(?)
        AND te.clock_out IS NOT NULL
    `;
    const params = [weekStart.toISOString(), weekEndDate.toISOString()];

    if (user_id) {
      query += ' AND te.user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY u.full_name, te.clock_in';

    const entries = await db.allAsync(query, params);

    const timeData = entries.map(mapPayrollTimeEntry);
    const groupedByUser = groupPayrollTimeByUser(timeData);

    res.json({ 
      success: true,
      week_ending_date,
      employees: Object.values(groupedByUser),
      total_entries: entries.length
    });
  } catch (error) {
    console.error('Sync time entries error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/payroll/sync/import-hours - Import hours from time entries to payroll
router.post('/sync/import-hours', requirePayrollAccess, async (req, res) => {
  try {
    const { week_ending_date, user_id } = req.body;
    
    if (!week_ending_date) {
      return res.status(400).json({ error: 'week_ending_date is required' });
    }

    const { weekStart, weekEndDate } = payrollWeekBoundsFromEndingDate(week_ending_date);

    // Reuse the time-entries query logic
    let query = `
      SELECT 
        te.*,
        u.full_name,
        u.username,
        u.hourly_rate,
        u.weekly_salary
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE DATE(te.clock_in) >= DATE(?)
        AND DATE(te.clock_in) <= DATE(?)
        AND te.clock_out IS NOT NULL
    `;
    const params = [weekStart.toISOString(), weekEndDate.toISOString()];

    if (user_id) {
      query += ' AND te.user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY u.full_name, te.clock_in';

    const entries = await db.allAsync(query, params);

    const timeData = entries.map(mapPayrollTimeEntry);
    const groupedByUser = groupPayrollTimeByUser(timeData);

    res.json({ 
      success: true,
      message: 'Time entries retrieved successfully',
      data: {
        week_ending_date,
        employees: Object.values(groupedByUser),
        total_entries: entries.length
      }
    });
  } catch (error) {
    console.error('Import hours error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/payroll/sync/payroll-summary - Get payroll summary for reporting
router.get('/sync/payroll-summary', requirePayrollAccess, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const { records: payrollHistory } = await loadMergedPayrollHistory();

    const filteredHistory = payrollHistoryInDateRange(payrollHistory, start_date, end_date);
    const totals = sumPayrollHistoryTotals(filteredHistory);

    res.json({
      success: true,
      summary: {
        period: { start_date, end_date },
        totals,
        records: filteredHistory.slice(0, 100) // Limit to recent 100 records
      }
    });
  } catch (error) {
    console.error('Get payroll summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/payroll/import/history - Merge imported pay history (from file upload); mirrors to SQLite for production.
router.post('/import/history', requirePayrollAccess, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Body must include "records" as a non-empty array' });
    }
    const { imported, total } = await mergeImportPayrollHistory(records);
    res.json({ success: true, imported, total });
  } catch (error) {
    console.error('Import payroll history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/payroll/financing-week-summary?week_ending=YYYY-MM-DD
router.get('/financing-week-summary', requireAdmin, async (req, res) => {
  try {
    const week = (req.query.week_ending || '').trim();
    if (!week) {
      return res.status(400).json({ error: 'Query parameter week_ending is required (e.g. 2026-04-04)' });
    }

    const pending = await db.allAsync(
      `
      SELECT
        f.id AS financing_id,
        f.user_id,
        f.external_party_name,
        f.external_party_company,
        (CASE WHEN f.user_id IS NOT NULL THEN u.full_name
         ELSE TRIM(COALESCE(f.external_party_name, '')) ||
           CASE WHEN f.external_party_company IS NOT NULL AND LENGTH(TRIM(f.external_party_company)) > 0
           THEN ' — ' || TRIM(f.external_party_company) ELSE '' END
        END) AS employee_name,
        u.username AS employee_username,
        f.item_description,
        f.total_amount,
        f.balance_due,
        f.weekly_payment,
        f.deduction_reason,
        (CASE
          WHEN f.weekly_payment < f.balance_due THEN f.weekly_payment
          ELSE f.balance_due
        END) AS suggested_deduction
      FROM employee_shop_financing f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE f.status = 'active'
        AND f.deduct_from_payroll = 1
        AND f.balance_due > 0
        AND NOT EXISTS (
          SELECT 1 FROM employee_shop_financing_deductions d
          WHERE d.financing_id = f.id AND d.week_ending_date = ?
        )
      ORDER BY LOWER(COALESCE(u.full_name, f.external_party_name, '')) ASC, f.id ASC
    `,
      [week]
    );

    const recorded = await db.allAsync(
      `
      SELECT
        d.id AS deduction_id,
        d.financing_id,
        d.week_ending_date,
        d.amount,
        d.reason_note,
        d.created_at,
        f.user_id,
        f.external_party_name,
        f.external_party_company,
        (CASE WHEN f.user_id IS NOT NULL THEN u.full_name
         ELSE TRIM(COALESCE(f.external_party_name, '')) ||
           CASE WHEN f.external_party_company IS NOT NULL AND LENGTH(TRIM(f.external_party_company)) > 0
           THEN ' — ' || TRIM(f.external_party_company) ELSE '' END
        END) AS employee_name,
        u.username AS employee_username,
        f.item_description
      FROM employee_shop_financing_deductions d
      JOIN employee_shop_financing f ON f.id = d.financing_id
      LEFT JOIN users u ON u.id = f.user_id
      WHERE d.week_ending_date = ?
      ORDER BY LOWER(COALESCE(u.full_name, f.external_party_name, '')) ASC, d.id ASC
    `,
      [week]
    );

    res.json({
      week_ending: week,
      pending_payroll_deductions: pending,
      recorded_this_week: recorded
    });
  } catch (error) {
    console.error('Financing week summary error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

export default router;

