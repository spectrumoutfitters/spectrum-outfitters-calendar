import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  createStripePaymentIntentForInvoice,
  createStripeSetupIntent,
  detachStripePaymentMethod,
  handleStripeEvent,
  setStripeDefaultPaymentMethod,
  syncStripePaymentMethodsToDb,
  verifyStripeWebhookEvent,
} from '../services/payments/stripePayments.js';

const router = express.Router();

router.use(authenticateToken);
// Payments are part of daily operations; allow authenticated team members.

// GET /api/payments/invoices/:id/payments
router.get('/invoices/:id/payments', async (req, res) => {
  try {
    const invoiceId = req.params.id != null ? Number(req.params.id) : null;
    if (!invoiceId || !Number.isFinite(invoiceId)) return res.status(400).json({ error: 'Invoice id is required' });

    const invoice = await db.getAsync('SELECT id, payment_status, total_cents, paid_at FROM crm_invoices WHERE id = ?', [invoiceId]);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const rows = await db.allAsync(
      `SELECT p.*, pm.brand, pm.last4, pm.exp_month, pm.exp_year
       FROM crm_invoice_payments p
       LEFT JOIN crm_payment_methods pm ON pm.id = p.crm_payment_method_id
       WHERE p.crm_invoice_id = ?
       ORDER BY p.created_at DESC`,
      [invoiceId]
    );

    res.json({ invoice, payments: rows || [] });
  } catch (e) {
    console.error('List invoice payments error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payments/invoices/:id/create-intent
router.post('/invoices/:id/create-intent', async (req, res) => {
  try {
    const invoiceId = req.params.id != null ? Number(req.params.id) : null;
    if (!invoiceId || !Number.isFinite(invoiceId)) return res.status(400).json({ error: 'Invoice id is required' });

    const result = await createStripePaymentIntentForInvoice(invoiceId);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    console.error('Create payment intent error:', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// POST /api/payments/customers/:id/setup-intent
router.post('/customers/:id/setup-intent', async (req, res) => {
  try {
    const crmCustomerId = req.params.id != null ? Number(req.params.id) : null;
    if (!crmCustomerId || !Number.isFinite(crmCustomerId)) return res.status(400).json({ error: 'Customer id is required' });

    const result = await createStripeSetupIntent(crmCustomerId);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    console.error('Create setup intent error:', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// GET /api/payments/customers/:id/payment-methods
router.get('/customers/:id/payment-methods', async (req, res) => {
  try {
    const crmCustomerId = req.params.id != null ? Number(req.params.id) : null;
    if (!crmCustomerId || !Number.isFinite(crmCustomerId)) return res.status(400).json({ error: 'Customer id is required' });

    const result = await syncStripePaymentMethodsToDb(crmCustomerId);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ methods: result.methods || [] });
  } catch (e) {
    console.error('List payment methods error:', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// POST /api/payments/customers/:id/payment-methods/:pmId/default
router.post('/customers/:id/payment-methods/:pmId/default', async (req, res) => {
  try {
    const crmCustomerId = req.params.id != null ? Number(req.params.id) : null;
    const pmId = req.params.pmId ? String(req.params.pmId) : null;
    if (!crmCustomerId || !Number.isFinite(crmCustomerId) || !pmId) return res.status(400).json({ error: 'Customer id and payment method id are required' });

    const result = await setStripeDefaultPaymentMethod(crmCustomerId, pmId);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (e) {
    console.error('Set default payment method error:', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// DELETE /api/payments/customers/:id/payment-methods/:pmId
router.delete('/customers/:id/payment-methods/:pmId', async (req, res) => {
  try {
    const crmCustomerId = req.params.id != null ? Number(req.params.id) : null;
    const pmId = req.params.pmId ? String(req.params.pmId) : null;
    if (!crmCustomerId || !Number.isFinite(crmCustomerId) || !pmId) return res.status(400).json({ error: 'Customer id and payment method id are required' });

    const result = await detachStripePaymentMethod(crmCustomerId, pmId);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete payment method error:', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// POST /api/payments/invoices/:id/record-manual — record non-card payment types
router.post('/invoices/:id/record-manual', async (req, res) => {
  try {
    const invoiceId = req.params.id != null ? Number(req.params.id) : null;
    if (!invoiceId || !Number.isFinite(invoiceId)) return res.status(400).json({ error: 'Invoice id is required' });

    const { amount_cents, payment_method_type, payment_reference } = req.body || {};
    const amount = Number(amount_cents);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount_cents must be > 0' });

    const type = String(payment_method_type || '').trim().toLowerCase();
    if (!type) return res.status(400).json({ error: 'payment_method_type is required' });

    const ref = payment_reference != null && String(payment_reference).trim() ? String(payment_reference).trim() : null;

    await db.runAsync(
      `INSERT INTO crm_invoice_payments (crm_invoice_id, provider, amount_cents, payment_method_type, status, raw_json)
       VALUES (?, 'manual', ?, ?, 'paid', ?)`,
      [invoiceId, Math.round(amount), type, JSON.stringify({ ref })]
    );

    // Update invoice status
    const invoice = await db.getAsync('SELECT total_cents FROM crm_invoices WHERE id = ?', [invoiceId]);
    const total = Number(invoice?.total_cents) || 0;
    const paidRow = await db.getAsync(
      `SELECT SUM(amount_cents) AS paid
       FROM crm_invoice_payments
       WHERE crm_invoice_id = ? AND status IN ('succeeded', 'paid')`,
      [invoiceId]
    );
    const paid = Number(paidRow?.paid) || 0;
    const paymentStatus = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    await db.runAsync(
      `UPDATE crm_invoices
       SET payment_status = ?, paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE paid_at END,
           payment_method_type = ?, payment_reference = ?
       WHERE id = ?`,
      [paymentStatus, paymentStatus, type, ref, invoiceId]
    ).catch(() => {});

    res.json({ ok: true, payment_status: paymentStatus });
  } catch (e) {
    console.error('Record manual payment error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Stripe webhook handler (raw body)
export async function handleStripePaymentsWebhook(req, res) {
  try {
    const sig = req.headers['stripe-signature'];
    const rawBody = req.body; // Buffer
    const event = verifyStripeWebhookEvent(rawBody, sig);
    if (!event) return res.status(400).send('Invalid signature or missing STRIPE_PAYMENTS_WEBHOOK_SECRET/STRIPE_WEBHOOK_SECRET');

    await handleStripeEvent(event);
    return res.json({ received: true });
  } catch (e) {
    console.error('Payments webhook error:', e);
    return res.status(500).send('Webhook handler error');
  }
}

export default router;

