import db from './db.js';

export async function addQuoteAffiliateTables() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS quote_affiliate_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        label TEXT,
        assigned_user_id INTEGER REFERENCES users(id),
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_quote_affiliate_links_assigned
      ON quote_affiliate_links(assigned_user_id)
    `).catch(() => {});

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS quote_affiliate_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        affiliate_link_id INTEGER NOT NULL REFERENCES quote_affiliate_links(id) ON DELETE CASCADE,
        shopmonkey_work_request_id TEXT,
        shopmonkey_order_id TEXT,
        shopmonkey_customer_id TEXT,
        customer_first_name TEXT,
        customer_last_name TEXT,
        customer_email TEXT,
        customer_phone TEXT,
        vehicle_vin TEXT,
        vehicle_license_plate TEXT,
        vehicle_year TEXT,
        vehicle_make TEXT,
        vehicle_model TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        raw_json TEXT,
        commission_paid INTEGER DEFAULT 0,
        initial_invoice_id INTEGER REFERENCES crm_invoices(id) ON DELETE SET NULL,
        commission_amount_cents INTEGER,
        commission_settled_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_quote_aff_sub_link
      ON quote_affiliate_submissions(affiliate_link_id, submitted_at DESC)
    `).catch(() => {});

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_quote_aff_sub_order
      ON quote_affiliate_submissions(shopmonkey_order_id)
    `).catch(() => {});

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_quote_aff_sub_customer
      ON quote_affiliate_submissions(shopmonkey_customer_id)
    `).catch(() => {});

    // Helpful for webhook upserts (token is the stable identifier)
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_quote_aff_sub_work_request
      ON quote_affiliate_submissions(shopmonkey_work_request_id)
    `).catch(() => {});

    // In case crm_invoices doesn't exist yet, this will fail at runtime unless startup order guarantees it.
    // We still keep the table definition above; SQLite allows creating FK columns even when referenced table is missing.
  } catch (e) {
    console.warn('Quote affiliate tables migration warning:', e?.message || e);
  }
}

