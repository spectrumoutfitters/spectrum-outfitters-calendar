import db from './db.js';

export async function addCrmBackfillJobsTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS crm_backfill_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','cancelled')),
        start_date TEXT,
        end_date TEXT,
        offset INTEGER DEFAULT 0,
        page_limit INTEGER DEFAULT 50,
        processed_count INTEGER DEFAULT 0,
        synced_count INTEGER DEFAULT 0,
        skipped_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        last_order_id TEXT,
        last_error TEXT,
        started_at DATETIME,
        finished_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_crm_backfill_jobs_status ON crm_backfill_jobs(status, created_at DESC)').catch(() => {});
    console.log('✅ crm_backfill_jobs table ready');
  } catch (e) {
    console.warn('crm_backfill_jobs migration warning:', e.message);
  }
}

