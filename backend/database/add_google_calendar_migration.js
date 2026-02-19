import db from './db.js';

const addGoogleCalendarSupport = async () => {
  try {
    // Ensure schedule_entries exists first (otherwise ALTER TABLE will fail)
    try {
      await db.getAsync('SELECT 1 FROM schedule_entries LIMIT 1');
    } catch (err) {
      console.error('❌ schedule_entries table not found.');
      console.error('Please run: node backend/database/add_schedule_migration.js');
      process.exit(1);
    }

    // Google Calendar configuration storage (single-row table)
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS google_calendar_config (
        id INTEGER PRIMARY KEY,
        access_token TEXT,
        refresh_token TEXT,
        token_expiry TEXT,
        calendar_id TEXT,
        sync_token TEXT,
        last_synced_at TEXT,
        is_connected INTEGER DEFAULT 0
      )
    `);

    // OAuth state storage (persisted so restarts don't break auth flow)
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS google_oauth_states (
        state TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        user_id INTEGER
      )
    `);

    // Seed the singleton row if missing
    await db.runAsync(
      `INSERT OR IGNORE INTO google_calendar_config (id, is_connected, calendar_id) VALUES (1, 0, 'primary')`
    );

    // Add mapping + metadata columns on schedule_entries (idempotent)
    await db.runAsync(`ALTER TABLE schedule_entries ADD COLUMN google_event_id TEXT`).catch(() => {
      console.log('google_event_id column may already exist');
    });

    await db.runAsync(`ALTER TABLE schedule_entries ADD COLUMN source TEXT DEFAULT 'app'`).catch(() => {
      console.log('source column may already exist');
    });

    await db.runAsync(`ALTER TABLE schedule_entries ADD COLUMN last_synced_at TEXT`).catch(() => {
      console.log('last_synced_at column may already exist');
    });

    // Helpful indexes
    await db.runAsync(
      `CREATE INDEX IF NOT EXISTS idx_schedule_google_event_id ON schedule_entries(google_event_id)`
    );
    await db.runAsync(
      `CREATE INDEX IF NOT EXISTS idx_schedule_source ON schedule_entries(source)`
    );

    console.log('✅ Google Calendar migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding Google Calendar support:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

addGoogleCalendarSupport();

