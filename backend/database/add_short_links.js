import db from './db.js';

/**
 * Create short_links table for invoice / payment link shortener.
 * Idempotent and safe to run on every startup.
 */
export async function addShortLinksTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS short_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        target_url TEXT NOT NULL,
        label TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_short_links_slug ON short_links(slug)').catch(() => {});
  } catch (_) {
    // If this fails, the rest of the app should still work; log silently here.
  }
}

