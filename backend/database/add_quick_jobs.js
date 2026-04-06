import db from './db.js';

export async function addQuickJobsTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_quick_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_quick_job_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quick_job_id INTEGER NOT NULL REFERENCES crm_quick_jobs(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('part','labor','fee')),
        inventory_item_id INTEGER REFERENCES inventory_items(id),
        description TEXT,
        part_number TEXT,
        quantity REAL,
        unit_price_cents INTEGER,
        discount_type TEXT CHECK(discount_type IN ('percent','amount')) DEFAULT NULL,
        discount_value REAL,
        line_order INTEGER DEFAULT 0
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_quick_jobs_active ON crm_quick_jobs(is_active, sort_order, id)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_quick_job_items_job ON crm_quick_job_items(quick_job_id, line_order, id)').catch(() => {});
    console.log('✅ Quick jobs tables ready');
  } catch (e) {
    console.warn('Quick jobs migration warning:', e.message);
  }
}

