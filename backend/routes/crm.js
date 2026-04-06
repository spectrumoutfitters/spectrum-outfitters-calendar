import express from 'express';
import crypto from 'crypto';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  cancelBackfillJob,
  enqueueBackfillJob,
  getBackfillJob,
  scheduleBackfillWorker,
  syncShopmonkeyOrderToCrm,
} from '../services/crm/shopmonkeyCrmSync.js';

const router = express.Router();

router.use(authenticateToken);
// CRM / invoicing is intended for the whole team (authenticated users).
// Keep ShopMonkey backfill/sync admin-only on those specific endpoints.

// Ensure backfill worker loop is running (cheap idempotent call)
scheduleBackfillWorker();

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function cleanStr(v) {
  const s = v == null ? '' : String(v);
  const t = s.trim();
  return t ? t : null;
}

function normalizeLineType(v) {
  const t = String(v || '').trim().toLowerCase();
  if (!t) return 'part';
  if (t.startsWith('lab')) return 'labor';
  if (t.startsWith('fee') || t === 'misc') return 'fee';
  if (t.startsWith('tax')) return 'fee';
  if (t.startsWith('par')) return 'part';
  return t;
}

function baseAppUrl(req) {
  const env = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
  if (env) return env;
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').toString().split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}

function shortLinkBase(req) {
  const base = (process.env.SHORT_LINK_BASE_URL || '').trim().replace(/\/+$/, '');
  if (base) return base;
  return baseAppUrl(req);
}

async function recalcInvoiceTotals(invoiceId) {
  const items = await db.allAsync(
    `SELECT line_type, total_cents
     FROM crm_invoice_items
     WHERE invoice_id = ?`,
    [invoiceId]
  );

  let parts = 0;
  let labor = 0;
  let fees = 0;

  for (const it of items || []) {
    const cents = toInt(it?.total_cents) || 0;
    const type = normalizeLineType(it?.line_type);
    if (type === 'labor') labor += cents;
    else if (type === 'fee') fees += cents;
    else parts += cents;
  }

  const inv = await db.getAsync('SELECT tax_cents FROM crm_invoices WHERE id = ?', [invoiceId]);
  const tax = toInt(inv?.tax_cents) || 0;
  const total = parts + labor + fees + tax;

  await db.runAsync(
    `UPDATE crm_invoices
     SET parts_cents = ?, labor_cents = ?, fees_cents = ?, total_cents = ?
     WHERE id = ?`,
    [parts, labor, fees, total, invoiceId]
  );

  // Best-effort refresh payment_status to match new totals.
  try {
    const paidRow = await db.getAsync(
      `SELECT SUM(amount_cents) AS paid
       FROM crm_invoice_payments
       WHERE crm_invoice_id = ? AND status IN ('succeeded', 'paid')`,
      [invoiceId]
    );
    const paid = toInt(paidRow?.paid) || 0;
    const paymentStatus = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    await db.runAsync(
      `UPDATE crm_invoices
       SET payment_status = ?, paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE paid_at END
       WHERE id = ?`,
      [paymentStatus, paymentStatus, invoiceId]
    ).catch(() => {});
  } catch {
    // ignore
  }
}

async function nextInvoiceNumber() {
  const key = 'crm_next_invoice_number';
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
    [key, '1000']
  ).catch(() => {});

  const row = await db.getAsync('SELECT value FROM app_settings WHERE key = ?', [key]);
  const current = Number(row?.value);
  const n = Number.isFinite(current) ? Math.max(1, Math.floor(current)) : 1000;
  const next = n + 1;
  await db.runAsync('UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [String(next), key]);
  return String(n);
}

// POST /api/crm/sync/order/:orderId — fetch from ShopMonkey and cache invoice + customer + vehicle + items
router.post('/sync/order/:orderId', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const result = await syncShopmonkeyOrderToCrm(orderId, { force: true });
    if (result.error) return res.status(500).json({ error: result.error });
    res.json(result);
  } catch (error) {
    console.error('CRM sync order error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync order' });
  }
});

// POST /api/crm/backfill/start — enqueue a resumable backfill job (ShopMonkey → CRM cache)
router.post('/backfill/start', requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date, page_limit } = req.body || {};
    const job = await enqueueBackfillJob({ start_date, end_date, page_limit });
    res.json({ job });
  } catch (error) {
    console.error('CRM backfill start error:', error);
    res.status(500).json({ error: error.message || 'Failed to start backfill' });
  }
});

// GET /api/crm/backfill/:id — read job status/progress
router.get('/backfill/:id', requireAdmin, async (req, res) => {
  try {
    const job = await getBackfillJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job });
  } catch (error) {
    console.error('CRM backfill status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/crm/backfill/:id/cancel — cancel job
router.post('/backfill/:id/cancel', requireAdmin, async (req, res) => {
  try {
    const result = await cancelBackfillJob(req.params.id);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (error) {
    console.error('CRM backfill cancel error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/crm/customers — create native customer
router.post('/customers', async (req, res) => {
  try {
    const displayName = cleanStr(req.body?.display_name) || cleanStr(req.body?.name);
    if (!displayName) return res.status(400).json({ error: 'display_name is required' });

    const phone = cleanStr(req.body?.phone);
    const email = cleanStr(req.body?.email);

    const r = await db.runAsync(
      `INSERT INTO crm_customers (source, shopmonkey_customer_id, display_name, phone, email, raw_json, updated_at)
       VALUES ('native', NULL, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
      [displayName, phone, email]
    );
    const customer = await db.getAsync('SELECT * FROM crm_customers WHERE id = ?', [r.lastID]);
    res.json({ customer });
  } catch (error) {
    console.error('Create CRM customer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/crm/customers/:id — update native customer fields
router.put('/customers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Customer id is required' });

    const existing = await db.getAsync('SELECT * FROM crm_customers WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const displayName = cleanStr(req.body?.display_name);
    const phone = cleanStr(req.body?.phone);
    const email = cleanStr(req.body?.email);

    await db.runAsync(
      `UPDATE crm_customers
       SET display_name = COALESCE(?, display_name),
           phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [displayName, phone, email, id]
    );

    const customer = await db.getAsync('SELECT * FROM crm_customers WHERE id = ?', [id]);
    res.json({ customer });
  } catch (error) {
    console.error('Update CRM customer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/crm/customers/:id/vehicles — vehicles for a customer (native + ShopMonkey-linked)
router.get('/customers/:id/vehicles', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Customer id is required' });
    const customer = await db.getAsync('SELECT * FROM crm_customers WHERE id = ?', [id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const rows = await db.allAsync(
      `SELECT id, source, shopmonkey_vehicle_id, year, make, model, vin, license_plate, updated_at
       FROM crm_vehicles
       WHERE crm_customer_id = ?
          OR ( ? IS NOT NULL AND shopmonkey_customer_id = ? )
       ORDER BY updated_at DESC, id DESC`,
      [id, customer.shopmonkey_customer_id, customer.shopmonkey_customer_id]
    );
    res.json({ vehicles: rows || [] });
  } catch (error) {
    console.error('List customer vehicles error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/crm/customers/:id/vehicles — create native vehicle under customer
router.post('/customers/:id/vehicles', async (req, res) => {
  try {
    const crmCustomerId = Number(req.params.id);
    if (!Number.isFinite(crmCustomerId)) return res.status(400).json({ error: 'Customer id is required' });
    const customer = await db.getAsync('SELECT * FROM crm_customers WHERE id = ?', [crmCustomerId]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const year = cleanStr(req.body?.year);
    const make = cleanStr(req.body?.make);
    const model = cleanStr(req.body?.model);
    const vin = cleanStr(req.body?.vin);
    const plate = cleanStr(req.body?.license_plate);

    const r = await db.runAsync(
      `INSERT INTO crm_vehicles
        (source, shopmonkey_vehicle_id, shopmonkey_customer_id, crm_customer_id, year, make, model, vin, license_plate, raw_json, updated_at)
       VALUES
        ('native', NULL, NULL, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
      [crmCustomerId, year, make, model, vin, plate]
    );
    const vehicle = await db.getAsync('SELECT * FROM crm_vehicles WHERE id = ?', [r.lastID]);
    res.json({ vehicle });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/crm/vehicles/:id — update vehicle
router.put('/vehicles/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Vehicle id is required' });
    const existing = await db.getAsync('SELECT * FROM crm_vehicles WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Vehicle not found' });

    const year = cleanStr(req.body?.year);
    const make = cleanStr(req.body?.make);
    const model = cleanStr(req.body?.model);
    const vin = cleanStr(req.body?.vin);
    const plate = cleanStr(req.body?.license_plate);

    await db.runAsync(
      `UPDATE crm_vehicles
       SET year = COALESCE(?, year),
           make = COALESCE(?, make),
           model = COALESCE(?, model),
           vin = COALESCE(?, vin),
           license_plate = COALESCE(?, license_plate),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [year, make, model, vin, plate, id]
    );

    const vehicle = await db.getAsync('SELECT * FROM crm_vehicles WHERE id = ?', [id]);
    res.json({ vehicle });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/crm/invoices — create native invoice
router.post('/invoices', async (req, res) => {
  try {
    const crmCustomerId = req.body?.crm_customer_id != null ? Number(req.body.crm_customer_id) : null;
    const crmVehicleId = req.body?.crm_vehicle_id != null ? Number(req.body.crm_vehicle_id) : null;
    if (!crmCustomerId || !Number.isFinite(crmCustomerId)) return res.status(400).json({ error: 'crm_customer_id is required' });

    const customer = await db.getAsync('SELECT id FROM crm_customers WHERE id = ?', [crmCustomerId]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    if (crmVehicleId) {
      const vehicle = await db.getAsync('SELECT id FROM crm_vehicles WHERE id = ?', [crmVehicleId]);
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    }

    const invoiceDate = cleanStr(req.body?.invoice_date) || new Date().toISOString().slice(0, 10);
    const taxCents = toInt(req.body?.tax_cents) || 0;
    const status = cleanStr(req.body?.status) || 'open';

    const number = await nextInvoiceNumber();

    const r = await db.runAsync(
      `INSERT INTO crm_invoices
        (source, shopmonkey_order_id, shopmonkey_order_number, status, invoice_date,
         shopmonkey_customer_id, shopmonkey_vehicle_id, crm_customer_id, crm_vehicle_id, invoice_number,
         labor_cents, parts_cents, fees_cents, tax_cents, total_cents, raw_json, synced_at)
       VALUES
        ('native', NULL, NULL, ?, ?, NULL, NULL, ?, ?, ?, 0, 0, 0, ?, ?, NULL, CURRENT_TIMESTAMP)`,
      [status, invoiceDate, crmCustomerId, crmVehicleId || null, number, taxCents, taxCents]
    );

    const invoice = await db.getAsync('SELECT * FROM crm_invoices WHERE id = ?', [r.lastID]);
    res.json({ invoice });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/crm/invoices/:id — update invoice header (native or shopmonkey cached)
router.put('/invoices/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invoice id is required' });
    const existing = await db.getAsync('SELECT * FROM crm_invoices WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const invoiceDate = cleanStr(req.body?.invoice_date);
    const status = cleanStr(req.body?.status);
    const taxCents = req.body?.tax_cents != null ? toInt(req.body.tax_cents) : null;

    await db.runAsync(
      `UPDATE crm_invoices
       SET invoice_date = COALESCE(?, invoice_date),
           status = COALESCE(?, status),
           tax_cents = COALESCE(?, tax_cents)
       WHERE id = ?`,
      [invoiceDate, status, taxCents, id]
    );

    await recalcInvoiceTotals(id).catch(() => {});

    const invoice = await db.getAsync('SELECT * FROM crm_invoices WHERE id = ?', [id]);
    res.json({ invoice });
  } catch (error) {
    console.error('Update invoice header error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/crm/invoices/:id/items — add line item (native invoices)
router.post('/invoices/:id/items', async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    if (!Number.isFinite(invoiceId)) return res.status(400).json({ error: 'Invoice id is required' });
    const invoice = await db.getAsync('SELECT * FROM crm_invoices WHERE id = ?', [invoiceId]);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const lineType = normalizeLineType(req.body?.line_type);
    const description = cleanStr(req.body?.description);
    const partNumber = cleanStr(req.body?.part_number);
    const quantity = req.body?.quantity != null ? Number(req.body.quantity) : 1;
    if (!Number.isFinite(quantity) || quantity <= 0) return res.status(400).json({ error: 'quantity must be > 0' });

    const unitPriceCents = toInt(req.body?.unit_price_cents);
    const totalCents = req.body?.total_cents != null ? toInt(req.body.total_cents) : (unitPriceCents != null ? Math.round(quantity * unitPriceCents) : null);
    if (totalCents == null || totalCents < 0) return res.status(400).json({ error: 'unit_price_cents or total_cents is required' });

    const invItemId = req.body?.inventory_item_id != null ? Number(req.body.inventory_item_id) : null;
    const inventoryItemId = Number.isFinite(invItemId) ? invItemId : null;

    const r = await db.runAsync(
      `INSERT INTO crm_invoice_items
        (invoice_id, shopmonkey_line_item_id, line_type, description, part_number, quantity, unit_price_cents, total_cents, inventory_item_id, raw_json)
       VALUES
        (?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [invoiceId, lineType, description, partNumber, quantity, unitPriceCents, totalCents, inventoryItemId]
    );

    await recalcInvoiceTotals(invoiceId).catch(() => {});

    const item = await db.getAsync('SELECT * FROM crm_invoice_items WHERE id = ?', [r.lastID]);
    res.json({ item });
  } catch (error) {
    console.error('Add invoice item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/crm/invoice-items/:id — update a line item
router.put('/invoice-items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Line item id is required' });

    const existing = await db.getAsync('SELECT * FROM crm_invoice_items WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Line item not found' });

    const lineType = req.body?.line_type != null ? normalizeLineType(req.body.line_type) : null;
    const description = req.body?.description != null ? cleanStr(req.body.description) : null;
    const partNumber = req.body?.part_number != null ? cleanStr(req.body.part_number) : null;
    const quantity = req.body?.quantity != null ? Number(req.body.quantity) : null;
    if (quantity != null && (!Number.isFinite(quantity) || quantity <= 0)) return res.status(400).json({ error: 'quantity must be > 0' });

    const unitPriceCents = req.body?.unit_price_cents != null ? toInt(req.body.unit_price_cents) : null;
    const totalCents = req.body?.total_cents != null ? toInt(req.body.total_cents) : null;

    // Recompute total if quantity/unit updated but total not provided
    let computedTotal = totalCents;
    const q = quantity != null ? quantity : Number(existing.quantity) || 1;
    const u = unitPriceCents != null ? unitPriceCents : toInt(existing.unit_price_cents);
    if (computedTotal == null && u != null) computedTotal = Math.round(q * u);

    await db.runAsync(
      `UPDATE crm_invoice_items
       SET line_type = COALESCE(?, line_type),
           description = COALESCE(?, description),
           part_number = COALESCE(?, part_number),
           quantity = COALESCE(?, quantity),
           unit_price_cents = COALESCE(?, unit_price_cents),
           total_cents = COALESCE(?, total_cents)
       WHERE id = ?`,
      [lineType, description, partNumber, quantity, unitPriceCents, computedTotal, id]
    );

    await recalcInvoiceTotals(existing.invoice_id).catch(() => {});

    const item = await db.getAsync('SELECT * FROM crm_invoice_items WHERE id = ?', [id]);
    res.json({ item });
  } catch (error) {
    console.error('Update invoice item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/crm/invoice-items/:id — delete a line item
router.delete('/invoice-items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Line item id is required' });

    const existing = await db.getAsync('SELECT * FROM crm_invoice_items WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Line item not found' });

    await db.runAsync('DELETE FROM crm_invoice_items WHERE id = ?', [id]);
    await recalcInvoiceTotals(existing.invoice_id).catch(() => {});
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete invoice item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/crm/invoices/:id/recalculate — force totals recalculation
router.post('/invoices/:id/recalculate', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invoice id is required' });
    const existing = await db.getAsync('SELECT id FROM crm_invoices WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });
    await recalcInvoiceTotals(id);
    const invoice = await db.getAsync('SELECT * FROM crm_invoices WHERE id = ?', [id]);
    res.json({ invoice });
  } catch (error) {
    console.error('Recalculate invoice error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/crm/invoices/:id/payment-link — create/get a public payment link for an invoice
router.post('/invoices/:id/payment-link', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invoice id is required' });

    const invoice = await db.getAsync('SELECT id, invoice_number FROM crm_invoices WHERE id = ?', [id]);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Reuse existing active token if present
    let link = await db.getAsync(
      `SELECT token, slug FROM crm_invoice_payment_links WHERE crm_invoice_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    if (!link?.token) {
      const token = crypto.randomBytes(16).toString('hex');
      await db.runAsync(
        `INSERT INTO crm_invoice_payment_links (crm_invoice_id, token, created_by, is_active)
         VALUES (?, ?, ?, 1)`,
        [id, token, req.user?.id || null]
      );
      link = { token, slug: null };
    }

    const appUrl = baseAppUrl(req);
    const payPath = `/pay/${link.token}`;
    const payUrl = appUrl ? `${appUrl}${payPath}` : payPath;

    // Optional short link: /secure/:slug that redirects to payUrl
    let shortUrl = null;
    if (!link.slug) {
      const slug = crypto.randomBytes(6).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();
      try {
        await db.runAsync(
          `INSERT INTO short_links (slug, target_url, label, created_by)
           VALUES (?, ?, ?, ?)`,
          [slug, payUrl, `Invoice ${invoice.invoice_number || invoice.id}`, req.user?.id || null]
        );
        await db.runAsync(
          `UPDATE crm_invoice_payment_links SET slug = ? WHERE crm_invoice_id = ? AND token = ?`,
          [slug, id, link.token]
        );
        link.slug = slug;
      } catch {
        // ignore collisions; still return direct payUrl
      }
    }

    if (link.slug) {
      const base = shortLinkBase(req);
      if (base) shortUrl = `${base}/secure/${link.slug}`;
    }

    res.json({ token: link.token, pay_url: payUrl, short_url: shortUrl });
  } catch (error) {
    console.error('Create payment link error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----- QUICK JOB TEMPLATES (admin-only management, everyone can use via apply) -----

router.get('/quick-jobs', async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT id, name, color, is_active, sort_order, created_at, updated_at
       FROM crm_quick_jobs
       ORDER BY is_active DESC, sort_order ASC, id ASC`
    );
    res.json({ jobs: rows || [] });
  } catch (error) {
    console.error('List quick jobs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin-only: create/update/delete templates + items
router.get('/quick-jobs/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Quick job id is required' });
    const job = await db.getAsync('SELECT * FROM crm_quick_jobs WHERE id = ?', [id]);
    if (!job) return res.status(404).json({ error: 'Quick job not found' });
    const items = await db.allAsync(
      `SELECT * FROM crm_quick_job_items WHERE quick_job_id = ? ORDER BY line_order ASC, id ASC`,
      [id]
    );
    res.json({ job, items: items || [] });
  } catch (error) {
    console.error('Get quick job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/quick-jobs', requireAdmin, async (req, res) => {
  try {
    const { name, color, is_active, sort_order, items } = req.body || {};
    const cleanName = cleanStr(name);
    if (!cleanName) return res.status(400).json({ error: 'name is required' });

    const r = await db.runAsync(
      `INSERT INTO crm_quick_jobs (name, color, is_active, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [cleanName, cleanStr(color), is_active ? 1 : 1, Number(sort_order) || 0, req.user?.id || null]
    );
    const jobId = r.lastID;

    if (Array.isArray(items)) {
      let order = 0;
      for (const it of items) {
        const kind = normalizeLineType(it.kind || it.line_type || 'part');
        await db.runAsync(
          `INSERT INTO crm_quick_job_items
            (quick_job_id, kind, inventory_item_id, description, part_number, quantity, unit_price_cents, discount_type, discount_value, line_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            jobId,
            kind,
            it.inventory_item_id != null ? Number(it.inventory_item_id) : null,
            cleanStr(it.description),
            cleanStr(it.part_number),
            it.quantity != null ? Number(it.quantity) : null,
            it.unit_price_cents != null ? toInt(it.unit_price_cents) : null,
            it.discount_type === 'percent' || it.discount_type === 'amount' ? it.discount_type : null,
            it.discount_value != null ? Number(it.discount_value) : null,
            order++,
          ]
        );
      }
    }

    const job = await db.getAsync('SELECT * FROM crm_quick_jobs WHERE id = ?', [jobId]);
    const rows = await db.allAsync(
      `SELECT * FROM crm_quick_job_items WHERE quick_job_id = ? ORDER BY line_order ASC, id ASC`,
      [jobId]
    );
    res.json({ job, items: rows || [] });
  } catch (error) {
    console.error('Create quick job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/quick-jobs/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Quick job id is required' });
    const existing = await db.getAsync('SELECT * FROM crm_quick_jobs WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Quick job not found' });

    const { name, color, is_active, sort_order, items } = req.body || {};
    await db.runAsync(
      `UPDATE crm_quick_jobs
       SET name = COALESCE(?, name),
           color = COALESCE(?, color),
           is_active = COALESCE(?, is_active),
           sort_order = COALESCE(?, sort_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name != null ? cleanStr(name) : null,
        color != null ? cleanStr(color) : null,
        typeof is_active === 'boolean' ? (is_active ? 1 : 0) : null,
        sort_order != null ? Number(sort_order) : null,
        id,
      ]
    );

    if (Array.isArray(items)) {
      await db.runAsync('DELETE FROM crm_quick_job_items WHERE quick_job_id = ?', [id]);
      let order = 0;
      for (const it of items) {
        const kind = normalizeLineType(it.kind || it.line_type || 'part');
        await db.runAsync(
          `INSERT INTO crm_quick_job_items
            (quick_job_id, kind, inventory_item_id, description, part_number, quantity, unit_price_cents, discount_type, discount_value, line_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            kind,
            it.inventory_item_id != null ? Number(it.inventory_item_id) : null,
            cleanStr(it.description),
            cleanStr(it.part_number),
            it.quantity != null ? Number(it.quantity) : null,
            it.unit_price_cents != null ? toInt(it.unit_price_cents) : null,
            it.discount_type === 'percent' || it.discount_type === 'amount' ? it.discount_type : null,
            it.discount_value != null ? Number(it.discount_value) : null,
            order++,
          ]
        );
      }
    }

    const job = await db.getAsync('SELECT * FROM crm_quick_jobs WHERE id = ?', [id]);
    const rows = await db.allAsync(
      `SELECT * FROM crm_quick_job_items WHERE quick_job_id = ? ORDER BY line_order ASC, id ASC`,
      [id]
    );
    res.json({ job, items: rows || [] });
  } catch (error) {
    console.error('Update quick job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/quick-jobs/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Quick job id is required' });
    await db.runAsync('DELETE FROM crm_quick_jobs WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete quick job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Apply quick job to invoice — any authenticated user can use buttons
router.post('/invoices/:id/apply-quick-job/:jobId', async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const jobId = Number(req.params.jobId);
    if (!Number.isFinite(invoiceId) || !Number.isFinite(jobId)) {
      return res.status(400).json({ error: 'Invoice id and quick job id are required' });
    }

    const invoice = await db.getAsync('SELECT * FROM crm_invoices WHERE id = ?', [invoiceId]);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const job = await db.getAsync('SELECT * FROM crm_quick_jobs WHERE id = ? AND is_active = 1', [jobId]);
    if (!job) return res.status(404).json({ error: 'Quick job not found' });

    const items = await db.allAsync(
      `SELECT * FROM crm_quick_job_items WHERE quick_job_id = ? ORDER BY line_order ASC, id ASC`,
      [jobId]
    );
    if (!items || items.length === 0) return res.status(400).json({ error: 'Quick job has no items' });

    for (const it of items) {
      const kind = normalizeLineType(it.kind || 'part');
      const qty = it.quantity != null ? Number(it.quantity) : 1;
      const unit = it.unit_price_cents != null ? toInt(it.unit_price_cents) : null;
      let total = unit != null ? Math.round(qty * unit) : null;

      if (it.discount_type && it.discount_value != null && total != null) {
        const dv = Number(it.discount_value);
        if (it.discount_type === 'percent') {
          total = Math.max(0, Math.round(total * (1 - dv / 100)));
        } else if (it.discount_type === 'amount') {
          total = Math.max(0, total - toInt(dv) || 0);
        }
      }

      await db.runAsync(
        `INSERT INTO crm_invoice_items
          (invoice_id, shopmonkey_line_item_id, line_type, description, part_number, quantity, unit_price_cents, total_cents, inventory_item_id, raw_json)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          invoiceId,
          kind,
          cleanStr(it.description),
          cleanStr(it.part_number),
          qty,
          unit,
          total,
          it.inventory_item_id != null ? Number(it.inventory_item_id) : null,
        ]
      );
    }

    await recalcInvoiceTotals(invoiceId);

    const updated = await db.getAsync(
      `SELECT i.*, COALESCE(cn.display_name, cs.display_name) AS customer_name
       FROM crm_invoices i
       LEFT JOIN crm_customers cs ON cs.shopmonkey_customer_id = i.shopmonkey_customer_id
       LEFT JOIN crm_customers cn ON cn.id = i.crm_customer_id
       WHERE i.id = ?`,
      [invoiceId]
    );
    res.json({ invoice: updated });
  } catch (error) {
    console.error('Apply quick job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/crm/invoices — list cached invoices
router.get('/invoices', async (req, res) => {
  try {
    const { q, customer_id, vehicle_id, crm_customer_id, crm_vehicle_id, start_date, end_date, limit } = req.query || {};
    const where = [];
    const params = [];

    if (customer_id) {
      where.push('i.shopmonkey_customer_id = ?');
      params.push(String(customer_id));
    }
    if (crm_customer_id) {
      where.push('i.crm_customer_id = ?');
      params.push(Number(crm_customer_id));
    }
    if (vehicle_id) {
      where.push('i.shopmonkey_vehicle_id = ?');
      params.push(String(vehicle_id));
    }
    if (crm_vehicle_id) {
      where.push('i.crm_vehicle_id = ?');
      params.push(Number(crm_vehicle_id));
    }
    if (start_date) {
      where.push('i.invoice_date >= ?');
      params.push(String(start_date));
    }
    if (end_date) {
      where.push('i.invoice_date <= ?');
      params.push(String(end_date));
    }
    if (q) {
      where.push(`(
        i.invoice_number LIKE ?
        OR i.shopmonkey_order_number LIKE ?
        OR i.shopmonkey_order_id LIKE ?
        OR COALESCE(cn.display_name, cs.display_name) LIKE ?
        OR COALESCE(vn.vin, vs.vin) LIKE ?
        OR COALESCE(vn.license_plate, vs.license_plate) LIKE ?
      )`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const lim = limit ? Number(limit) : 50;
    params.push(Number.isFinite(lim) ? Math.min(200, Math.max(1, lim)) : 50);

    const rows = await db.allAsync(
      `SELECT
         i.id,
         i.source,
         i.invoice_number,
         i.shopmonkey_order_id,
         i.shopmonkey_order_number,
         i.status,
         i.invoice_date,
         i.total_cents,
         i.parts_cents,
         i.labor_cents,
         i.tax_cents,
         i.shopmonkey_customer_id,
         i.crm_customer_id,
         COALESCE(cn.display_name, cs.display_name) AS customer_name,
         i.shopmonkey_vehicle_id,
         i.crm_vehicle_id,
         COALESCE(vn.year, vs.year) AS year,
         COALESCE(vn.make, vs.make) AS make,
         COALESCE(vn.model, vs.model) AS model,
         COALESCE(vn.vin, vs.vin) AS vin,
         COALESCE(vn.license_plate, vs.license_plate) AS license_plate
       FROM crm_invoices i
       LEFT JOIN crm_customers cs ON cs.shopmonkey_customer_id = i.shopmonkey_customer_id
       LEFT JOIN crm_customers cn ON cn.id = i.crm_customer_id
       LEFT JOIN crm_vehicles vs ON vs.shopmonkey_vehicle_id = i.shopmonkey_vehicle_id
       LEFT JOIN crm_vehicles vn ON vn.id = i.crm_vehicle_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY COALESCE(i.invoice_date, '0000-00-00') DESC, i.id DESC
       LIMIT ?`,
      params
    );

    res.json({ invoices: rows || [] });
  } catch (error) {
    console.error('CRM list invoices error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/crm/invoices/:id — invoice detail + line items
router.get('/invoices/:id', async (req, res) => {
  try {
    const id = req.params.id != null ? Number(req.params.id) : null;
    if (!id || !Number.isFinite(id)) return res.status(400).json({ error: 'Invoice id is required' });

    const invoice = await db.getAsync(
      `SELECT
          i.*,
          COALESCE(cn.display_name, cs.display_name) AS customer_name,
          COALESCE(cn.phone, cs.phone) AS customer_phone,
          COALESCE(cn.email, cs.email) AS customer_email,
          COALESCE(i.crm_customer_id, cs.id) AS crm_customer_id,
          COALESCE(i.crm_vehicle_id, vn.id, vs.id) AS crm_vehicle_id,
          COALESCE(vn.year, vs.year) AS year,
          COALESCE(vn.make, vs.make) AS make,
          COALESCE(vn.model, vs.model) AS model,
          COALESCE(vn.vin, vs.vin) AS vin,
          COALESCE(vn.license_plate, vs.license_plate) AS license_plate
       FROM crm_invoices i
       LEFT JOIN crm_customers cs ON cs.shopmonkey_customer_id = i.shopmonkey_customer_id
       LEFT JOIN crm_customers cn ON cn.id = i.crm_customer_id
       LEFT JOIN crm_vehicles vs ON vs.shopmonkey_vehicle_id = i.shopmonkey_vehicle_id
       LEFT JOIN crm_vehicles vn ON vn.id = i.crm_vehicle_id
       WHERE i.id = ?`,
      [id]
    );
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const items = await db.allAsync(
      `SELECT li.*, inv.name AS inventory_item_name
       FROM crm_invoice_items li
       LEFT JOIN inventory_items inv ON inv.id = li.inventory_item_id
       WHERE li.invoice_id = ?
       ORDER BY li.id ASC`,
      [id]
    );

    res.json({ invoice, items: items || [] });
  } catch (error) {
    console.error('CRM invoice detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/crm/customers — list cached customers
router.get('/customers', async (req, res) => {
  try {
    const { q, limit } = req.query || {};
    const where = [];
    const params = [];
    if (q) {
      where.push('(display_name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const lim = limit ? Number(limit) : 50;
    params.push(Number.isFinite(lim) ? Math.min(200, Math.max(1, lim)) : 50);

    const rows = await db.allAsync(
      `SELECT id, source, shopmonkey_customer_id, display_name, phone, email, updated_at
       FROM crm_customers
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY COALESCE(display_name, '') ASC
       LIMIT ?`,
      params
    );
    res.json({ customers: rows || [] });
  } catch (error) {
    console.error('CRM list customers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/crm/customers/:id/history — invoice + parts history for a customer (by internal crm_customers.id)
router.get('/customers/:id/history', async (req, res) => {
  try {
    const id = req.params.id != null ? Number(req.params.id) : null;
    if (!id || !Number.isFinite(id)) return res.status(400).json({ error: 'Customer id is required' });

    const customer = await db.getAsync('SELECT * FROM crm_customers WHERE id = ?', [id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const vehicles = await db.allAsync(
      `SELECT id, source, shopmonkey_vehicle_id, year, make, model, vin, license_plate, updated_at
       FROM crm_vehicles
       WHERE crm_customer_id = ?
          OR ( ? IS NOT NULL AND shopmonkey_customer_id = ? )
       ORDER BY updated_at DESC`,
      [customer.id, customer.shopmonkey_customer_id, customer.shopmonkey_customer_id]
    );

    const invoices = await db.allAsync(
      `SELECT id, source, invoice_number, shopmonkey_order_id, shopmonkey_order_number, invoice_date, status, total_cents, parts_cents, labor_cents, tax_cents, shopmonkey_vehicle_id, crm_vehicle_id
       FROM crm_invoices
       WHERE crm_customer_id = ?
          OR ( ? IS NOT NULL AND shopmonkey_customer_id = ? )
       ORDER BY COALESCE(invoice_date, '0000-00-00') DESC, id DESC`,
      [customer.id, customer.shopmonkey_customer_id, customer.shopmonkey_customer_id]
    );

    // Flatten parts/items per customer across all invoices (for quick “what did they buy”)
    const parts = await db.allAsync(
      `SELECT
         li.inventory_item_id,
         inv.name AS inventory_item_name,
         li.part_number,
         li.description,
         SUM(COALESCE(li.quantity, 0)) AS qty
       FROM crm_invoice_items li
       JOIN crm_invoices i ON i.id = li.invoice_id
       LEFT JOIN inventory_items inv ON inv.id = li.inventory_item_id
       WHERE i.crm_customer_id = ?
          OR ( ? IS NOT NULL AND i.shopmonkey_customer_id = ? )
       GROUP BY li.inventory_item_id, li.part_number, li.description
       ORDER BY qty DESC
       LIMIT 200`,
      [customer.id, customer.shopmonkey_customer_id, customer.shopmonkey_customer_id]
    );

    res.json({ customer, vehicles: vehicles || [], invoices: invoices || [], parts: parts || [] });
  } catch (error) {
    console.error('CRM customer history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/customers/:id', async (req, res) => {
  try {
    const id = req.params.id != null ? Number(req.params.id) : null;
    if (!id || !Number.isFinite(id)) return res.status(400).json({ error: 'Customer id is required' });

    const customer = await db.getAsync('SELECT * FROM crm_customers WHERE id = ?', [id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const vehicles = await db.allAsync(
      `SELECT id, source, shopmonkey_vehicle_id, year, make, model, vin, license_plate, updated_at
       FROM crm_vehicles
       WHERE crm_customer_id = ?
          OR ( ? IS NOT NULL AND shopmonkey_customer_id = ? )
       ORDER BY updated_at DESC`,
      [customer.id, customer.shopmonkey_customer_id, customer.shopmonkey_customer_id]
    );

    const invoices = await db.allAsync(
      `SELECT id, source, invoice_number, shopmonkey_order_id, shopmonkey_order_number, invoice_date, status, total_cents, parts_cents, labor_cents, tax_cents, shopmonkey_vehicle_id, crm_vehicle_id
       FROM crm_invoices
       WHERE crm_customer_id = ?
          OR ( ? IS NOT NULL AND shopmonkey_customer_id = ? )
       ORDER BY COALESCE(invoice_date, '0000-00-00') DESC, id DESC
       LIMIT 100`,
      [customer.id, customer.shopmonkey_customer_id, customer.shopmonkey_customer_id]
    );

    res.json({ customer, vehicles: vehicles || [], invoices: invoices || [] });
  } catch (error) {
    console.error('CRM customer detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/crm/vehicles/:id/history — invoice + parts history for a vehicle (by internal crm_vehicles.id)
router.get('/vehicles/:id/history', async (req, res) => {
  try {
    const id = req.params.id != null ? Number(req.params.id) : null;
    if (!id || !Number.isFinite(id)) return res.status(400).json({ error: 'Vehicle id is required' });

    const vehicle = await db.getAsync('SELECT * FROM crm_vehicles WHERE id = ?', [id]);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const invoices = await db.allAsync(
      `SELECT id, source, invoice_number, shopmonkey_order_id, shopmonkey_order_number, invoice_date, status, total_cents, parts_cents, labor_cents, tax_cents
       FROM crm_invoices
       WHERE crm_vehicle_id = ?
          OR ( ? IS NOT NULL AND shopmonkey_vehicle_id = ? )
       ORDER BY COALESCE(invoice_date, '0000-00-00') DESC, id DESC`,
      [vehicle.id, vehicle.shopmonkey_vehicle_id, vehicle.shopmonkey_vehicle_id]
    );

    const parts = await db.allAsync(
      `SELECT
         li.inventory_item_id,
         inv.name AS inventory_item_name,
         li.part_number,
         li.description,
         SUM(COALESCE(li.quantity, 0)) AS qty
       FROM crm_invoice_items li
       JOIN crm_invoices i ON i.id = li.invoice_id
       LEFT JOIN inventory_items inv ON inv.id = li.inventory_item_id
       WHERE i.crm_vehicle_id = ?
          OR ( ? IS NOT NULL AND i.shopmonkey_vehicle_id = ? )
       GROUP BY li.inventory_item_id, li.part_number, li.description
       ORDER BY qty DESC
       LIMIT 200`,
      [vehicle.id, vehicle.shopmonkey_vehicle_id, vehicle.shopmonkey_vehicle_id]
    );

    res.json({ vehicle, invoices: invoices || [], parts: parts || [] });
  } catch (error) {
    console.error('CRM vehicle history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/vehicles/:id', async (req, res) => {
  try {
    const id = req.params.id != null ? Number(req.params.id) : null;
    if (!id || !Number.isFinite(id)) return res.status(400).json({ error: 'Vehicle id is required' });

    const vehicle = await db.getAsync('SELECT * FROM crm_vehicles WHERE id = ?', [id]);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const invoices = await db.allAsync(
      `SELECT id, source, invoice_number, shopmonkey_order_id, shopmonkey_order_number, invoice_date, status, total_cents, parts_cents, labor_cents, tax_cents
       FROM crm_invoices
       WHERE crm_vehicle_id = ?
          OR ( ? IS NOT NULL AND shopmonkey_vehicle_id = ? )
       ORDER BY COALESCE(invoice_date, '0000-00-00') DESC, id DESC
       LIMIT 100`,
      [vehicle.id, vehicle.shopmonkey_vehicle_id, vehicle.shopmonkey_vehicle_id]
    );

    res.json({ vehicle, invoices: invoices || [] });
  } catch (error) {
    console.error('CRM vehicle detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

