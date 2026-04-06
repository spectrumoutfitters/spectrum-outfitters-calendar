import db from './db.js';

async function columnInfo(table) {
  try {
    return await db.allAsync(`PRAGMA table_info(${table})`);
  } catch {
    return [];
  }
}

function hasColumn(info, name) {
  return (info || []).some((c) => c?.name === name);
}

function notNullOf(info, name) {
  const col = (info || []).find((c) => c?.name === name);
  return col?.notnull === 1;
}

export async function migrateCrmNativeSupport() {
  try {
    const customersInfo = await columnInfo('crm_customers');
    const vehiclesInfo = await columnInfo('crm_vehicles');
    const invoicesInfo = await columnInfo('crm_invoices');

    // If tables don't exist yet, addCrmTables() will handle creation.
    if (!customersInfo.length || !vehiclesInfo.length || !invoicesInfo.length) return;

    const needsRebuild =
      notNullOf(customersInfo, 'shopmonkey_customer_id') ||
      notNullOf(vehiclesInfo, 'shopmonkey_vehicle_id') ||
      notNullOf(invoicesInfo, 'shopmonkey_order_id') ||
      !hasColumn(customersInfo, 'source') ||
      !hasColumn(vehiclesInfo, 'crm_customer_id') ||
      !hasColumn(invoicesInfo, 'crm_customer_id') ||
      !hasColumn(invoicesInfo, 'invoice_number');

    if (!needsRebuild) return;

    console.log('🧾 Migrating CRM tables for native invoicing support...');

    await db.runAsync('PRAGMA foreign_keys = OFF');
    await db.runAsync('BEGIN');

    // ---- customers
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_customers_new (
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

    if (hasColumn(customersInfo, 'shopmonkey_customer_id')) {
      await db.runAsync(
        `INSERT INTO crm_customers_new (id, source, shopmonkey_customer_id, display_name, phone, email, raw_json, updated_at, created_at)
         SELECT id,
                CASE WHEN shopmonkey_customer_id IS NULL THEN 'native' ELSE 'shopmonkey' END,
                shopmonkey_customer_id, display_name, phone, email, raw_json,
                COALESCE(updated_at, CURRENT_TIMESTAMP),
                COALESCE(created_at, CURRENT_TIMESTAMP)
         FROM crm_customers`
      );
    }

    // ---- vehicles
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_vehicles_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL DEFAULT 'shopmonkey' CHECK(source IN ('shopmonkey','native')),
        shopmonkey_vehicle_id TEXT UNIQUE,
        shopmonkey_customer_id TEXT,
        crm_customer_id INTEGER REFERENCES crm_customers_new(id),
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

    await db.runAsync(
      `INSERT INTO crm_vehicles_new (id, source, shopmonkey_vehicle_id, shopmonkey_customer_id, year, make, model, vin, license_plate, raw_json, updated_at, created_at)
       SELECT id,
              CASE WHEN shopmonkey_vehicle_id IS NULL THEN 'native' ELSE 'shopmonkey' END,
              shopmonkey_vehicle_id, shopmonkey_customer_id, year, make, model, vin, license_plate, raw_json,
              COALESCE(updated_at, CURRENT_TIMESTAMP),
              COALESCE(created_at, CURRENT_TIMESTAMP)
       FROM crm_vehicles`
    );

    // ---- invoices
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_invoices_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL DEFAULT 'shopmonkey' CHECK(source IN ('shopmonkey','native')),
        shopmonkey_order_id TEXT UNIQUE,
        shopmonkey_order_number TEXT,
        shopmonkey_workflow_status_id TEXT,
        status TEXT,
        invoice_date TEXT,
        shopmonkey_customer_id TEXT,
        shopmonkey_vehicle_id TEXT,
        crm_customer_id INTEGER REFERENCES crm_customers_new(id),
        crm_vehicle_id INTEGER REFERENCES crm_vehicles_new(id),
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

    await db.runAsync(
      `INSERT INTO crm_invoices_new (
         id, source, shopmonkey_order_id, shopmonkey_order_number, shopmonkey_workflow_status_id, status, invoice_date,
         shopmonkey_customer_id, shopmonkey_vehicle_id,
         labor_cents, parts_cents, fees_cents, tax_cents, total_cents,
         raw_json, synced_at, created_at
       )
       SELECT
         id,
         CASE WHEN shopmonkey_order_id IS NULL THEN 'native' ELSE 'shopmonkey' END,
         shopmonkey_order_id, shopmonkey_order_number, shopmonkey_workflow_status_id, status, invoice_date,
         shopmonkey_customer_id, shopmonkey_vehicle_id,
         labor_cents, parts_cents, fees_cents, tax_cents, total_cents,
         raw_json, COALESCE(synced_at, CURRENT_TIMESTAMP), COALESCE(created_at, CURRENT_TIMESTAMP)
       FROM crm_invoices`
    );

    // Swap tables
    await db.runAsync('DROP TABLE crm_invoices');
    await db.runAsync('ALTER TABLE crm_invoices_new RENAME TO crm_invoices');
    await db.runAsync('DROP TABLE crm_vehicles');
    await db.runAsync('ALTER TABLE crm_vehicles_new RENAME TO crm_vehicles');
    await db.runAsync('DROP TABLE crm_customers');
    await db.runAsync('ALTER TABLE crm_customers_new RENAME TO crm_customers');

    // Recreate indexes
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_customers_sm_id ON crm_customers(shopmonkey_customer_id)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_customers_source ON crm_customers(source, display_name)').catch(() => {});

    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_vehicles_sm_id ON crm_vehicles(shopmonkey_vehicle_id)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_vehicles_customer_sm_id ON crm_vehicles(shopmonkey_customer_id)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_vehicles_customer_crm_id ON crm_vehicles(crm_customer_id)').catch(() => {});

    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoices_customer ON crm_invoices(shopmonkey_customer_id, invoice_date)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoices_vehicle ON crm_invoices(shopmonkey_vehicle_id, invoice_date)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoices_crm_customer ON crm_invoices(crm_customer_id, invoice_date)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoices_crm_vehicle ON crm_invoices(crm_vehicle_id, invoice_date)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_invoices_sm_order ON crm_invoices(shopmonkey_order_id)').catch(() => {});
    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_invoices_invoice_number ON crm_invoices(invoice_number)').catch(() => {});

    await db.runAsync('COMMIT');
    await db.runAsync('PRAGMA foreign_keys = ON');

    console.log('✅ CRM tables migrated for native invoicing');
  } catch (e) {
    try {
      await db.runAsync('ROLLBACK');
    } catch {}
    await db.runAsync('PRAGMA foreign_keys = ON').catch(() => {});
    console.warn('CRM native support migration warning:', e.message);
  }
}

