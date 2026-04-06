import db from './db.js';

/**
 * CRM/Invoicing cache tables (ShopMonkey-backed).
 * These tables let us query invoice history, vehicles, and parts usage without
 * needing to hit ShopMonkey for every screen.
 */
export async function addCrmTables() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL DEFAULT 'shopmonkey' CHECK(source IN ('shopmonkey','native')),
        shopmonkey_customer_id TEXT UNIQUE,
        display_name TEXT,
        phone TEXT,
        email TEXT,
        raw_json TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_customers_sm_id ON crm_customers(shopmonkey_customer_id)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_customers_source ON crm_customers(source, display_name)').catch(() => {});

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL DEFAULT 'shopmonkey' CHECK(source IN ('shopmonkey','native')),
        shopmonkey_vehicle_id TEXT UNIQUE,
        shopmonkey_customer_id TEXT,
        crm_customer_id INTEGER REFERENCES crm_customers(id),
        year TEXT,
        make TEXT,
        model TEXT,
        vin TEXT,
        license_plate TEXT,
        raw_json TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_vehicles_sm_id ON crm_vehicles(shopmonkey_vehicle_id)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_vehicles_customer_sm_id ON crm_vehicles(shopmonkey_customer_id)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_vehicles_customer_crm_id ON crm_vehicles(crm_customer_id)').catch(() => {});

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL DEFAULT 'shopmonkey' CHECK(source IN ('shopmonkey','native')),
        shopmonkey_order_id TEXT UNIQUE,
        shopmonkey_order_number TEXT,
        shopmonkey_workflow_status_id TEXT,
        status TEXT,
        invoice_date TEXT,
        shopmonkey_customer_id TEXT,
        shopmonkey_vehicle_id TEXT,
        crm_customer_id INTEGER REFERENCES crm_customers(id),
        crm_vehicle_id INTEGER REFERENCES crm_vehicles(id),
        invoice_number TEXT,
        labor_cents INTEGER,
        parts_cents INTEGER,
        fees_cents INTEGER,
        tax_cents INTEGER,
        total_cents INTEGER,
        raw_json TEXT,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoices_customer ON crm_invoices(shopmonkey_customer_id, invoice_date)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoices_vehicle ON crm_invoices(shopmonkey_vehicle_id, invoice_date)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoices_crm_customer ON crm_invoices(crm_customer_id, invoice_date)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoices_crm_vehicle ON crm_invoices(crm_vehicle_id, invoice_date)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoices_sm_order ON crm_invoices(shopmonkey_order_id)').catch(() => {});
    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_invoices_invoice_number ON crm_invoices(invoice_number)').catch(() => {});

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL REFERENCES crm_invoices(id) ON DELETE CASCADE,
        shopmonkey_line_item_id TEXT,
        line_type TEXT,
        description TEXT,
        part_number TEXT,
        quantity REAL,
        unit_price_cents INTEGER,
        total_cents INTEGER,
        inventory_item_id INTEGER REFERENCES inventory_items(id),
        raw_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoice_items_invoice ON crm_invoice_items(invoice_id)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoice_items_inventory ON crm_invoice_items(inventory_item_id)').catch(() => {});

    console.log('✅ CRM tables ready');
  } catch (e) {
    console.warn('CRM tables migration warning:', e.message);
  }
}

