/**
 * Run at server startup so all routes see required tables/columns.
 * Idempotent - safe to run every time.
 */
import db from './db.js';
import { seedFeb2026Changelog } from './seed-changelog-feb2026.js';
import { addPlaidTables } from './add_plaid_tables.js';
import { addShopmonkeyRevenueTable } from './add_shopmonkey_revenue_table.js';
import { addProcessorRevenueTable } from './add_processor_revenue_table.js';
import { addSecurityTables } from './add_security_tables.js';
import { addPushSubscriptionsTable } from './add_push_subscriptions.js';
import { addInventoryTaskUsageTable } from './add_inventory_task_usage.js';
import { addTaskPhotosTable } from './add_task_photos.js';
import { addInventorySupplierColumns } from './add_inventory_supplier.js';
import { addInventoryLocationVendorAmazonColumns } from './add_inventory_locations_and_amazon.js';
import { addInventoryDealsTable } from './add_inventory_deals.js';
import { addCrmTables } from './add_crm_tables.js';
import { addPaymentsTables } from './add_payments_tables.js';
import { addQuantityLogTaskUsage } from './add_quantity_log_task_usage.js';
import { addCustomerStatusTable } from './add_customer_status.js';
import { addShortLinksTable } from './add_short_links.js';

export async function ensureUserColumns() {
  const columns = [
    { name: 'is_active', sql: 'ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1' },
    { name: 'weekly_salary', sql: 'ALTER TABLE users ADD COLUMN weekly_salary DECIMAL(10,2) DEFAULT 0' },
    { name: 'show_clock_in_header', sql: 'ALTER TABLE users ADD COLUMN show_clock_in_header BOOLEAN DEFAULT 1' },
    { name: 'payroll_access', sql: 'ALTER TABLE users ADD COLUMN payroll_access BOOLEAN DEFAULT 0' },
    { name: 'is_master_admin', sql: 'ALTER TABLE users ADD COLUMN is_master_admin BOOLEAN DEFAULT 0' },
    { name: 'last_login', sql: 'ALTER TABLE users ADD COLUMN last_login DATETIME' },
    { name: 'split_reimbursable_amount', sql: 'ALTER TABLE users ADD COLUMN split_reimbursable_amount REAL DEFAULT 0' },
    { name: 'split_reimbursable_notes', sql: 'ALTER TABLE users ADD COLUMN split_reimbursable_notes TEXT' },
    { name: 'split_reimbursable_period', sql: "ALTER TABLE users ADD COLUMN split_reimbursable_period TEXT DEFAULT 'weekly'" }
  ];
  try {
    const info = await db.allAsync('PRAGMA table_info(users)');
    const names = new Set((info || []).map(c => c.name));
    for (const col of columns) {
      if (!names.has(col.name)) {
        await db.runAsync(col.sql).catch(() => {});
      }
    }
  } catch (_) {}
}

export async function ensureAppSettingsTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key)').catch(() => {});
  } catch (_) {}
}

export async function ensureSystemUpdatesTables() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS system_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        version TEXT,
        update_type TEXT CHECK(update_type IN ('feature', 'bugfix', 'improvement', 'announcement', 'maintenance')) DEFAULT 'feature',
        priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
        is_active INTEGER DEFAULT 1,
        is_pending INTEGER DEFAULT 1,
        approved_by INTEGER REFERENCES users(id),
        approved_at DATETIME,
        show_on_login INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id)
      )
    `);
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS system_updates_read (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        update_id INTEGER NOT NULL REFERENCES system_updates(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(update_id, user_id)
      )
    `).catch(() => {});
  } catch (_) {}
}

export async function ensureNewItemRequestsTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_new_item_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requested_by INTEGER NOT NULL REFERENCES users(id),
        item_name TEXT NOT NULL,
        notes TEXT,
        barcode TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'addressed', 'dismissed')),
        addressed_at DATETIME,
        addressed_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_new_item_requests_status ON inventory_new_item_requests(status)').catch(() => {});
  } catch (_) {}
}

/** Alternate barcodes for inventory items (same product, different part number / barcode). */
export async function ensureInventoryAlternateBarcodesTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_item_barcodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        barcode TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(barcode)
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_inventory_item_barcodes_item ON inventory_item_barcodes(item_id)').catch(() => {});
    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_item_barcodes_barcode ON inventory_item_barcodes(barcode)').catch(() => {});
  } catch (_) {}
}

/** Ensure Neel (by username or name) has master admin and payroll access. */
export async function ensureNeelMasterAdmin() {
  try {
    await db.runAsync(`
      UPDATE users SET is_master_admin = 1, payroll_access = 1
      WHERE LOWER(username) = 'neel' OR LOWER(full_name) LIKE '%neel%'
    `);
  } catch (_) {}
}

/** Payroll-only people (e.g. contractors) not in users table. */
export async function ensurePayrollPeopleTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS payroll_people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        weekly_salary REAL DEFAULT 0,
        hourly_rate REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_payroll_people_active ON payroll_people(is_active)').catch(() => {});
  } catch (_) {}
}

/** Split salary reimbursable by another business + table for recording payments received. */
export async function ensurePayrollReimbursementsSetup() {
  try {
    const ppInfo = await db.allAsync('PRAGMA table_info(payroll_people)');
    const ppNames = new Set((ppInfo || []).map(c => c.name));
    if (!ppNames.has('split_reimbursable_amount')) {
      await db.runAsync('ALTER TABLE payroll_people ADD COLUMN split_reimbursable_amount REAL DEFAULT 0');
    }
    if (!ppNames.has('split_reimbursable_notes')) {
      await db.runAsync('ALTER TABLE payroll_people ADD COLUMN split_reimbursable_notes TEXT');
    }
    if (!ppNames.has('split_reimbursable_period')) {
      await db.runAsync("ALTER TABLE payroll_people ADD COLUMN split_reimbursable_period TEXT DEFAULT 'weekly'");
    }
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS payroll_reimbursements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL CHECK(source_type IN ('user', 'payroll_person')),
        source_id INTEGER NOT NULL,
        received_date TEXT NOT NULL,
        amount REAL NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_payroll_reimb_source ON payroll_reimbursements(source_type, source_id)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_payroll_reimb_date ON payroll_reimbursements(received_date)').catch(() => {});
  } catch (_) {}
}

/** Add is_vpn column to login_events for VPN/proxy detection (idempotent). */
export async function ensureLoginEventsIsVpn() {
  try {
    const info = await db.allAsync('PRAGMA table_info(login_events)');
    const hasIsVpn = (info || []).some(c => c.name === 'is_vpn');
    if (!hasIsVpn) {
      await db.runAsync('ALTER TABLE login_events ADD COLUMN is_vpn INTEGER DEFAULT 0');
    }
  } catch (_) {}
}

/** Ad-hoc inventory scan-outs (use item not on a task) — admin list and notifications. */
export async function ensureAdHocScanOutTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_ad_hoc_scan_out (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        quantity_used REAL NOT NULL,
        used_by INTEGER NOT NULL REFERENCES users(id),
        reason_text TEXT NOT NULL,
        barcode_scanned TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        acknowledged_at DATETIME,
        acknowledged_by INTEGER REFERENCES users(id)
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_ad_hoc_scan_out_item ON inventory_ad_hoc_scan_out(item_id)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_ad_hoc_scan_out_created ON inventory_ad_hoc_scan_out(created_at)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_ad_hoc_scan_out_ack ON inventory_ad_hoc_scan_out(acknowledged_at)').catch(() => {});
  } catch (_) {}
}

export async function runStartupMigrations() {
  await ensureUserColumns();
  await ensureNeelMasterAdmin();
  await ensureAppSettingsTable();
  await ensureSystemUpdatesTables();
  await ensureNewItemRequestsTable();
  await ensureInventoryAlternateBarcodesTable();
  await ensureAdHocScanOutTable();
  await seedFeb2026Changelog();
  await addPlaidTables();
  await addShopmonkeyRevenueTable();
  await addProcessorRevenueTable();
  await addSecurityTables();
  await ensureLoginEventsIsVpn();
  await addPushSubscriptionsTable();
  await addInventoryTaskUsageTable();
  await addTaskPhotosTable();
  await addInventorySupplierColumns();
  await addInventoryLocationVendorAmazonColumns();
  await addInventoryDealsTable();
  await addQuantityLogTaskUsage();
  await addCrmTables();
  await addPaymentsTables();
  await addCustomerStatusTable();
  await addShortLinksTable();
  await ensurePayrollPeopleTable();
  await ensurePayrollReimbursementsSetup();
}
