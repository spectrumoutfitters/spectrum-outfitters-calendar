import db from './db.js';

export async function addInvoicePaymentLinksTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_invoice_payment_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crm_invoice_id INTEGER NOT NULL REFERENCES crm_invoices(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        slug TEXT UNIQUE,
        created_by INTEGER REFERENCES users(id),
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_sent_at DATETIME
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoice_payment_links_invoice ON crm_invoice_payment_links(crm_invoice_id, created_at DESC)').catch(() => {});
    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_invoice_payment_links_invoice_active ON crm_invoice_payment_links(crm_invoice_id) WHERE is_active = 1').catch(() => {});
    console.log('✅ crm_invoice_payment_links table ready');
  } catch (e) {
    console.warn('Invoice payment links migration warning:', e.message);
  }
}

