import express from 'express';
import db from '../database/db.js';
import { createStripePaymentIntentForInvoice } from '../services/payments/stripePayments.js';

const router = express.Router();

function cents(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x) : 0;
}

async function getInvoiceByToken(token) {
  const row = await db.getAsync(
    `SELECT l.crm_invoice_id AS invoice_id
     FROM crm_invoice_payment_links l
     WHERE l.token = ? AND l.is_active = 1
     LIMIT 1`,
    [token]
  );
  if (!row?.invoice_id) return null;
  return await db.getAsync(
    `SELECT
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.status,
        i.total_cents,
        i.tax_cents,
        COALESCE(cn.display_name, cs.display_name) AS customer_name,
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
     WHERE i.id = ?
     LIMIT 1`,
    [row.invoice_id]
  );
}

async function amountDueCents(invoiceId) {
  const invoice = await db.getAsync('SELECT total_cents FROM crm_invoices WHERE id = ?', [invoiceId]);
  if (!invoice) return null;
  const total = cents(invoice.total_cents);
  const paidRow = await db.getAsync(
    `SELECT SUM(amount_cents) AS paid
     FROM crm_invoice_payments
     WHERE crm_invoice_id = ? AND status IN ('succeeded', 'paid')`,
    [invoiceId]
  );
  const paid = cents(paidRow?.paid);
  return Math.max(0, total - paid);
}

// GET /api/public/invoices/:token — public invoice summary for payment page
router.get('/api/public/invoices/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token is required' });
    const invoice = await getInvoiceByToken(token);
    if (!invoice) return res.status(404).json({ error: 'Invoice link not found' });
    const due = await amountDueCents(invoice.id);
    res.json({ invoice, amount_due_cents: due });
  } catch (e) {
    console.error('Public invoice get error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/public/invoices/:token/create-intent — create Stripe PaymentIntent for amount due
router.post('/api/public/invoices/:token/create-intent', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token is required' });
    const invoice = await getInvoiceByToken(token);
    if (!invoice) return res.status(404).json({ error: 'Invoice link not found' });

    const result = await createStripePaymentIntentForInvoice(invoice.id);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    console.error('Public invoice create intent error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

