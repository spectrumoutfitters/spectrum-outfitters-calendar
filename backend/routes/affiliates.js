import express from 'express';
import crypto from 'crypto';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

function makeToken(bytes = 12) {
  // URL-safe-ish: hex
  return crypto.randomBytes(bytes).toString('hex');
}

router.use(express.json({ limit: '50mb' }));

function customerBaseUrl() {
  const base =
    (process.env.CUSTOMER_AFFILIATE_BASE_URL ||
      process.env.CUSTOMER_PUBLIC_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      '').trim().replace(/\/+$/, '');
  return base || '';
}

function customerPathPrefix() {
  const p = (process.env.CUSTOMER_AFFILIATE_PATH_PREFIX || '').trim().replace(/\/+$/, '');
  if (!p) return '';
  return p.startsWith('/') ? p : `/${p}`;
}

// Admin: create affiliate link token
router.post('/links', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : null;
    const assigned_user_id = req.body?.assigned_user_id != null ? Number(req.body.assigned_user_id) : null;

    if (assigned_user_id != null && (!Number.isFinite(assigned_user_id) || assigned_user_id <= 0)) {
      return res.status(400).json({ error: 'assigned_user_id must be a valid number' });
    }

    const token = makeToken(10);

    const r = await db.runAsync(
      `INSERT INTO quote_affiliate_links (token, label, assigned_user_id, created_by)
       VALUES (?, ?, ?, ?)`,
      [token, label || null, assigned_user_id, req.user.id]
    );

    const link = await db.getAsync(
      `SELECT l.*, u.full_name AS assigned_user_name
       FROM quote_affiliate_links l
       LEFT JOIN users u ON u.id = l.assigned_user_id
       WHERE l.id = ?`,
      [r.lastID]
    );

    // Customer landing page is served directly by the backend (not the React SPA),
    // so we build an absolute URL to /affiliates/:token on the public main site.
    const cBase = customerBaseUrl();
    const prefix = customerPathPrefix();
    const path = `${prefix}/affiliates/${token}`.replace(/\/+/g, '/');

    res.status(201).json({
      link,
      path: path.startsWith('/') ? path : `/${path}`,
      full_url: cBase ? `${cBase}${path}` : null,
    });
  } catch (e) {
    console.error('Create affiliate link error:', e);
    res.status(500).json({ error: e?.message || 'Failed to create affiliate link' });
  }
});

// Admin: list affiliate links with submission counts
router.get('/links', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const links = await db.allAsync(
      `
      SELECT
        l.id,
        l.token,
        l.label,
        l.assigned_user_id,
        u.full_name AS assigned_user_name,
        l.created_at,
        COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS submission_count,
        COALESCE(SUM(CASE WHEN s.commission_paid = 1 THEN 1 ELSE 0 END), 0) AS paid_submission_count,
        MAX(s.submitted_at) AS latest_submission_at
      FROM quote_affiliate_links l
      LEFT JOIN quote_affiliate_submissions s ON s.affiliate_link_id = l.id
      LEFT JOIN users u ON u.id = l.assigned_user_id
      GROUP BY l.id
      ORDER BY l.created_at DESC
      `
    );

    const cBase = customerBaseUrl();
    const prefix = customerPathPrefix();

    const mapped = (links || []).map((l) => {
      const path = `${prefix}/affiliates/${l.token}`.replace(/\/+/g, '/');
      return {
        ...l,
        full_url: cBase ? `${cBase}${path}` : null,
        path: path.startsWith('/') ? path : `/${path}`,
      };
    });

    res.json({ links: mapped });
  } catch (e) {
    console.error('List affiliate links error:', e);
    res.status(500).json({ error: e?.message || 'Failed to list affiliate links' });
  }
});

// Public: optional tracking endpoint (works if we can capture postMessage from the iframe)
router.post('/public/track', async (req, res) => {
  try {
    const token = String(req.body?.affiliate_token || req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'affiliate_token is required' });

    const link = await db.getAsync('SELECT id FROM quote_affiliate_links WHERE token = ?', [token]);
    if (!link) return res.status(404).json({ error: 'Affiliate token not found' });

    const workRequestId = req.body?.shopmonkey_work_request_id != null ? String(req.body.shopmonkey_work_request_id) : null;
    const orderId = req.body?.shopmonkey_order_id != null ? String(req.body.shopmonkey_order_id) : null;
    const customerId = req.body?.shopmonkey_customer_id != null ? String(req.body.shopmonkey_customer_id) : null;

    const raw_json = req.body?.raw_json ? JSON.stringify(req.body.raw_json) : JSON.stringify(req.body || {});

    // If we have any stable ids, try to find an existing record.
    const whereParts = [];
    const params = [link.id];
    if (workRequestId) {
      whereParts.push('shopmonkey_work_request_id = ?');
      params.push(workRequestId);
    }
    if (orderId) {
      whereParts.push('shopmonkey_order_id = ?');
      params.push(orderId);
    }
    if (customerId) {
      whereParts.push('shopmonkey_customer_id = ?');
      params.push(customerId);
    }

    let existing = null;
    if (whereParts.length > 0) {
      existing = await db.getAsync(
        `SELECT id FROM quote_affiliate_submissions
         WHERE affiliate_link_id = ? AND (${whereParts.join(' OR ')})
         ORDER BY submitted_at DESC
         LIMIT 1`,
        params
      );
    }

    if (existing?.id) {
      await db.runAsync(
        `UPDATE quote_affiliate_submissions
         SET raw_json = COALESCE(raw_json, '') || '\n' || ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [raw_json, existing.id]
      );
      return res.json({ ok: true, submission_id: existing.id, deduped: true });
    }

    const r = await db.runAsync(
      `INSERT INTO quote_affiliate_submissions
        (affiliate_link_id, shopmonkey_work_request_id, shopmonkey_order_id, shopmonkey_customer_id, raw_json)
       VALUES (?, ?, ?, ?, ?)`,
      [link.id, workRequestId, orderId, customerId, raw_json]
    );

    res.status(201).json({ ok: true, submission_id: r.lastID, deduped: false });
  } catch (e) {
    console.error('Public track error:', e);
    res.status(500).json({ error: e?.message || 'Failed to track submission' });
  }
});

// Admin: list submissions for a link token
router.get('/submissions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const token = String(req.query?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token is required' });

    const link = await db.getAsync('SELECT id FROM quote_affiliate_links WHERE token = ?', [token]);
    if (!link) return res.status(404).json({ error: 'Affiliate token not found' });

    const rows = await db.allAsync(
      `
      SELECT *
      FROM quote_affiliate_submissions
      WHERE affiliate_link_id = ?
      ORDER BY submitted_at DESC
      LIMIT 200
      `,
      [link.id]
    );

    res.json({ submissions: rows || [] });
  } catch (e) {
    console.error('List submissions error:', e);
    res.status(500).json({ error: e?.message || 'Failed to list submissions' });
  }
});

// Admin: reconcile commission eligibility based on paid CRM invoices
// Rule: commission is paid only when the customer has a paid invoice, and only to the earliest affiliate submission for that customer.
router.post('/admin/reconcile', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const unpaidCustomers = await db.allAsync(
      `
      SELECT DISTINCT shopmonkey_customer_id AS customer_id
      FROM quote_affiliate_submissions
      WHERE commission_paid = 0
        AND shopmonkey_customer_id IS NOT NULL
      `
    );

    let updated = 0;
    const updatedSubmissions = [];

    for (const row of unpaidCustomers || []) {
      const customerId = row?.customer_id;
      if (!customerId) continue;

      const firstPaidInvoice = await db.getAsync(
        `
        SELECT id, invoice_date, paid_at
        FROM crm_invoices
        WHERE shopmonkey_customer_id = ?
          AND payment_status = 'paid'
        ORDER BY COALESCE(paid_at, invoice_date, created_at) ASC
        LIMIT 1
        `,
        [String(customerId)]
      );

      if (!firstPaidInvoice?.id) continue;

      // Earliest affiliate submission for this customer that hasn't been paid yet.
      const earliestSubmission = await db.getAsync(
        `
        SELECT id
        FROM quote_affiliate_submissions
        WHERE commission_paid = 0
          AND shopmonkey_customer_id = ?
        ORDER BY submitted_at ASC
        LIMIT 1
        `,
        [String(customerId)]
      );

      if (!earliestSubmission?.id) continue;

      await db.runAsync(
        `
        UPDATE quote_affiliate_submissions
        SET commission_paid = 1,
            initial_invoice_id = ?,
            commission_settled_at = CURRENT_TIMESTAMP
        WHERE id = ? AND commission_paid = 0
        `,
        [firstPaidInvoice.id, earliestSubmission.id]
      );

      updated += 1;
      updatedSubmissions.push({ submission_id: earliestSubmission.id, crm_invoice_id: firstPaidInvoice.id, shopmonkey_customer_id: String(customerId) });
    }

    res.json({ ok: true, updated_count: updated, updated_submissions: updatedSubmissions });
  } catch (e) {
    console.error('Reconcile commission error:', e);
    res.status(500).json({ error: e?.message || 'Failed to reconcile commissions' });
  }
});

// Admin: manually mark a submission as commission-paid (for when auto-reconcile can't match yet)
router.post('/admin/submissions/:id/mark-paid', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid submission id' });

    const crm_invoice_id =
      req.body?.crm_invoice_id != null ? Number(req.body.crm_invoice_id) : null;
    if (crm_invoice_id != null && (!Number.isFinite(crm_invoice_id) || crm_invoice_id <= 0)) {
      return res.status(400).json({ error: 'crm_invoice_id must be a valid number' });
    }

    await db.runAsync(
      `
      UPDATE quote_affiliate_submissions
      SET commission_paid = 1,
          initial_invoice_id = COALESCE(?, initial_invoice_id),
          commission_settled_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [crm_invoice_id, id]
    );

    res.json({ ok: true, submission_id: id });
  } catch (e) {
    console.error('Manual mark-paid error:', e);
    res.status(500).json({ error: e?.message || 'Failed to mark paid' });
  }
});

export default router;

