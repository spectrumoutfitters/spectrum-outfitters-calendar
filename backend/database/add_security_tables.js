import db from './db.js';

/**
 * Creates login_events and user_sessions tables for session audit / on-prem tracking.
 * Called from startup.js — idempotent via CREATE TABLE IF NOT EXISTS.
 */
export async function addSecurityTables() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS login_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        username TEXT NOT NULL,
        success INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip TEXT,
        forwarded_for TEXT,
        user_agent TEXT,
        browser_geo_lat REAL,
        browser_geo_lng REAL,
        browser_geo_accuracy_m REAL,
        ip_geo_country TEXT,
        ip_geo_region TEXT,
        ip_geo_city TEXT,
        ip_geo_lat REAL,
        ip_geo_lng REAL,
        ip_geo_source TEXT,
        on_prem_network_ok INTEGER DEFAULT 0,
        on_prem_geo_ok INTEGER DEFAULT 0,
        on_prem_score INTEGER DEFAULT 0
      )
    `);

    await db.runAsync(
      'CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events(user_id, occurred_at DESC)'
    ).catch(() => {});
    await db.runAsync(
      'CREATE INDEX IF NOT EXISTS idx_login_events_time ON login_events(occurred_at DESC)'
    ).catch(() => {});

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip TEXT,
        user_agent TEXT,
        socket_id TEXT,
        active INTEGER NOT NULL DEFAULT 1
      )
    `);

    await db.runAsync(
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(active, user_id)'
    ).catch(() => {});
    await db.runAsync(
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, started_at DESC)'
    ).catch(() => {});

    console.log('Security tables (login_events, user_sessions) ready');
  } catch (error) {
    console.error('Error creating security tables:', error);
  }
}

if (process.argv[1] && process.argv[1].includes('add_security_tables')) {
  addSecurityTables().then(() => process.exit(0));
}
