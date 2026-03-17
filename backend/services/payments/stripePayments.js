import Stripe from 'stripe';
import db from '../../database/db.js';

function getStripe() {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!key || !key.startsWith('sk_')) return null;
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

function cents(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x) : null;
}

export async function getOrCreateStripeCustomerForCrmCustomer(crmCustomerId) {
  const stripe = getStripe();
  if (!stripe) return { error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' };

  const existing = await db.getAsync(
    `SELECT provider_customer_id FROM crm_payment_customers WHERE crm_customer_id = ? AND provider = 'stripe'`,
    [crmCustomerId]
  );
  if (existing?.provider_customer_id) return { providerCustomerId: existing.provider_customer_id };

  const crmCustomer = await db.getAsync('SELECT * FROM crm_customers WHERE id = ?', [crmCustomerId]);
  if (!crmCustomer) return { error: 'CRM customer not found' };

  const customer = await stripe.customers.create({
    name: crmCustomer.display_name || undefined,
    email: crmCustomer.email || undefined,
    phone: crmCustomer.phone || undefined,
    metadata: {
      crm_customer_id: String(crmCustomerId),
      shopmonkey_customer_id: String(crmCustomer.shopmonkey_customer_id || ''),
    },
  });

  await db.runAsync(
    `INSERT INTO crm_payment_customers (crm_customer_id, provider, provider_customer_id)
     VALUES (?, 'stripe', ?)
     ON CONFLICT(crm_customer_id, provider) DO UPDATE SET provider_customer_id = excluded.provider_customer_id`,
    [crmCustomerId, customer.id]
  );

  return { providerCustomerId: customer.id };
}

export async function createStripeSetupIntent(crmCustomerId) {
  const stripe = getStripe();
  if (!stripe) return { error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' };

  const { providerCustomerId, error } = await getOrCreateStripeCustomerForCrmCustomer(crmCustomerId);
  if (error) return { error };

  const intent = await stripe.setupIntents.create({
    customer: providerCustomerId,
    payment_method_types: ['card'],
    usage: 'off_session',
    metadata: { crm_customer_id: String(crmCustomerId) },
  });

  return { customerId: providerCustomerId, clientSecret: intent.client_secret };
}

export async function syncStripePaymentMethodsToDb(crmCustomerId) {
  const stripe = getStripe();
  if (!stripe) return { error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' };

  const { providerCustomerId, error } = await getOrCreateStripeCustomerForCrmCustomer(crmCustomerId);
  if (error) return { error };

  const list = await stripe.paymentMethods.list({ customer: providerCustomerId, type: 'card' });
  const methods = list.data || [];

  // Mark all as non-default; we'll set default after.
  await db.runAsync(
    `UPDATE crm_payment_methods SET is_default = 0 WHERE crm_customer_id = ? AND provider = 'stripe'`,
    [crmCustomerId]
  ).catch(() => {});

  for (const pm of methods) {
    const card = pm.card || {};
    await db.runAsync(
      `INSERT INTO crm_payment_methods
        (crm_customer_id, provider, provider_payment_method_id, brand, last4, exp_month, exp_year, is_default)
       VALUES (?, 'stripe', ?, ?, ?, ?, ?, 0)
       ON CONFLICT(provider, provider_payment_method_id) DO UPDATE SET
         crm_customer_id=excluded.crm_customer_id,
         brand=excluded.brand,
         last4=excluded.last4,
         exp_month=excluded.exp_month,
         exp_year=excluded.exp_year`,
      [
        crmCustomerId,
        pm.id,
        card.brand || null,
        card.last4 || null,
        card.exp_month || null,
        card.exp_year || null,
      ]
    ).catch(() => {});
  }

  // Pull default from Stripe customer invoice settings (best-effort).
  try {
    const cust = await stripe.customers.retrieve(providerCustomerId);
    const defaultPmId = cust?.invoice_settings?.default_payment_method;
    if (defaultPmId) {
      await db.runAsync(
        `UPDATE crm_payment_methods SET is_default = 1 WHERE crm_customer_id = ? AND provider = 'stripe' AND provider_payment_method_id = ?`,
        [crmCustomerId, defaultPmId]
      ).catch(() => {});
    }
  } catch {
    // ignore
  }

  const rows = await db.allAsync(
    `SELECT id, provider_payment_method_id, brand, last4, exp_month, exp_year, is_default
     FROM crm_payment_methods
     WHERE crm_customer_id = ? AND provider = 'stripe'
     ORDER BY is_default DESC, created_at DESC`,
    [crmCustomerId]
  );

  return { methods: rows || [] };
}

export async function setStripeDefaultPaymentMethod(crmCustomerId, providerPaymentMethodId) {
  const stripe = getStripe();
  if (!stripe) return { error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' };

  const { providerCustomerId, error } = await getOrCreateStripeCustomerForCrmCustomer(crmCustomerId);
  if (error) return { error };

  await stripe.customers.update(providerCustomerId, {
    invoice_settings: { default_payment_method: providerPaymentMethodId },
  });

  await db.runAsync(
    `UPDATE crm_payment_methods SET is_default = CASE WHEN provider_payment_method_id = ? THEN 1 ELSE 0 END
     WHERE crm_customer_id = ? AND provider = 'stripe'`,
    [providerPaymentMethodId, crmCustomerId]
  ).catch(() => {});

  return { ok: true };
}

export async function detachStripePaymentMethod(crmCustomerId, providerPaymentMethodId) {
  const stripe = getStripe();
  if (!stripe) return { error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' };

  await stripe.paymentMethods.detach(providerPaymentMethodId);
  await db.runAsync(
    `DELETE FROM crm_payment_methods WHERE crm_customer_id = ? AND provider = 'stripe' AND provider_payment_method_id = ?`,
    [crmCustomerId, providerPaymentMethodId]
  ).catch(() => {});

  return { ok: true };
}

export async function createStripePaymentIntentForInvoice(crmInvoiceId) {
  const stripe = getStripe();
  if (!stripe) return { error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' };

  const invoice = await db.getAsync(
    `SELECT i.*, c.id AS crm_customer_id
     FROM crm_invoices i
     LEFT JOIN crm_customers c ON c.shopmonkey_customer_id = i.shopmonkey_customer_id
     WHERE i.id = ?`,
    [crmInvoiceId]
  );
  if (!invoice) return { error: 'Invoice not found' };
  if (!invoice.crm_customer_id) return { error: 'Invoice has no CRM customer (sync order first)' };

  const total = cents(invoice.total_cents);
  if (total == null || total <= 0) return { error: 'Invoice total is missing or zero' };

  const paidRow = await db.getAsync(
    `SELECT SUM(amount_cents) AS paid
     FROM crm_invoice_payments
     WHERE crm_invoice_id = ? AND status IN ('succeeded', 'paid')`,
    [crmInvoiceId]
  );
  const alreadyPaid = cents(paidRow?.paid) || 0;
  const amountDue = Math.max(0, total - alreadyPaid);
  if (amountDue <= 0) return { error: 'Invoice is already paid' };

  const { providerCustomerId, error } = await getOrCreateStripeCustomerForCrmCustomer(invoice.crm_customer_id);
  if (error) return { error };

  const intent = await stripe.paymentIntents.create({
    amount: amountDue,
    currency: 'usd',
    customer: providerCustomerId,
    automatic_payment_methods: { enabled: true },
    metadata: {
      crm_invoice_id: String(crmInvoiceId),
      crm_customer_id: String(invoice.crm_customer_id),
      shopmonkey_order_id: String(invoice.shopmonkey_order_id || ''),
    },
  });

  await db.runAsync(
    `INSERT INTO crm_invoice_payments
      (crm_invoice_id, provider, amount_cents, payment_method_type, provider_payment_intent_id, status, raw_json)
     VALUES (?, 'stripe', ?, 'card', ?, ?, ?)`,
    [crmInvoiceId, amountDue, intent.id, intent.status || 'created', JSON.stringify(intent)]
  ).catch(() => {});

  return { clientSecret: intent.client_secret, amountDueCents: amountDue };
}

export async function handleStripeEvent(event) {
  const type = event?.type || '';
  const obj = event?.data?.object || {};

  if (type === 'payment_intent.succeeded' || type === 'payment_intent.payment_failed') {
    const intentId = obj.id;
    const status = obj.status || (type === 'payment_intent.succeeded' ? 'succeeded' : 'failed');
    const crmInvoiceId = obj.metadata?.crm_invoice_id ? Number(obj.metadata.crm_invoice_id) : null;
    if (!crmInvoiceId || !Number.isFinite(crmInvoiceId)) return { ok: true };

    const chargeId = obj.latest_charge || null;
    await db.runAsync(
      `UPDATE crm_invoice_payments
       SET status = ?, provider_charge_id = COALESCE(provider_charge_id, ?), raw_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE provider = 'stripe' AND provider_payment_intent_id = ?`,
      [status, chargeId, JSON.stringify(obj), intentId]
    ).catch(() => {});

    // Update invoice payment_status (simple: paid if any succeeded payments cover total)
    const invoice = await db.getAsync('SELECT total_cents FROM crm_invoices WHERE id = ?', [crmInvoiceId]);
    const total = cents(invoice?.total_cents) || 0;
    const paidRow = await db.getAsync(
      `SELECT SUM(amount_cents) AS paid
       FROM crm_invoice_payments
       WHERE crm_invoice_id = ? AND status IN ('succeeded', 'paid')`,
      [crmInvoiceId]
    );
    const paid = cents(paidRow?.paid) || 0;

    const paymentStatus = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    await db.runAsync(
      `UPDATE crm_invoices
       SET payment_status = ?, paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE paid_at END
       WHERE id = ?`,
      [paymentStatus, paymentStatus, crmInvoiceId]
    ).catch(() => {});
  }

  if (type === 'setup_intent.succeeded') {
    // After setup succeeds, payment_method is attached to customer; we sync on-demand via API.
    return { ok: true };
  }

  return { ok: true };
}

export function verifyStripeWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  if (!stripe) return null;
  const secret = (process.env.STRIPE_PAYMENTS_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) return null;
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}

