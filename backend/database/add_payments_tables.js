import db from './db.js';

export async function addPaymentsTables() {
  try {
    // Extend crm_invoices for basic payment status tracking (idempotent).
    const info = await db.allAsync('PRAGMA table_info(crm_invoices)').catch(() => []);
    const names = new Set((info || []).map((c) => c.name));
    const addCol = async (name, sql) => {
      if (!names.has(name)) await db.runAsync(sql).catch(() => {});
    };
    await addCol('payment_status', "ALTER TABLE crm_invoices ADD COLUMN payment_status TEXT DEFAULT 'unpaid'");
    await addCol('paid_at', 'ALTER TABLE crm_invoices ADD COLUMN paid_at DATETIME');
    await addCol('payment_method_type', 'ALTER TABLE crm_invoices ADD COLUMN payment_method_type TEXT');
    await addCol('payment_reference', 'ALTER TABLE crm_invoices ADD COLUMN payment_reference TEXT');

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_payment_customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crm_customer_id INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_customer_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(crm_customer_id, provider)
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_payment_customers_provider ON crm_payment_customers(provider, provider_customer_id)').catch(() => {});

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crm_customer_id INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_payment_method_id TEXT NOT NULL,
        brand TEXT,
        last4 TEXT,
        exp_month INTEGER,
        exp_year INTEGER,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider, provider_payment_method_id)
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_payment_methods_customer ON crm_payment_methods(crm_customer_id, provider)').catch(() => {});

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_invoice_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crm_invoice_id INTEGER NOT NULL REFERENCES crm_invoices(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        payment_method_type TEXT,
        crm_payment_method_id INTEGER REFERENCES crm_payment_methods(id),
        provider_payment_intent_id TEXT,
        provider_charge_id TEXT,
        status TEXT NOT NULL,
        raw_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoice_payments_invoice ON crm_invoice_payments(crm_invoice_id, created_at DESC)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoice_payments_provider_intent ON crm_invoice_payments(provider, provider_payment_intent_id)').catch(() => {});

    console.log('✅ Payments tables ready');
  } catch (e) {
    console.warn('Payments tables migration warning:', e.message);
  }
}

