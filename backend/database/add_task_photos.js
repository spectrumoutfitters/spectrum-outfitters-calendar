import db from './db.js';

/**
 * Create task_photos table for before/after/progress job photos.
 */
export async function addTaskPhotosTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS task_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        uploaded_by INTEGER NOT NULL REFERENCES users(id),
        photo_type TEXT NOT NULL DEFAULT 'other' CHECK(photo_type IN ('before', 'after', 'progress', 'other')),
        file_path TEXT NOT NULL,
        caption TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_task_photos_task ON task_photos(task_id)').catch(() => {});
    console.log('✅ task_photos table ready');
  } catch (e) {
    console.warn('task_photos migration warning:', e.message);
  }
}
