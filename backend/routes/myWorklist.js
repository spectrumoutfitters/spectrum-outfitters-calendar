import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getTodayInHouston } from '../utils/appTimezone.js';

const router = express.Router();

router.use(authenticateToken);

function getTodayInCentral() {
  return getTodayInHouston();
}

async function ensureTable() {
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS user_worklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      item_date DATE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      is_completed INTEGER DEFAULT 0,
      completed_at DATETIME,
      archived_at DATETIME,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try {
    await db.runAsync(`ALTER TABLE user_worklist_items ADD COLUMN archived_at DATETIME`);
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
  await db.runAsync(`
    CREATE INDEX IF NOT EXISTS idx_user_worklist_user_date
    ON user_worklist_items(user_id, item_date)
  `);
  await db.runAsync(`
    CREATE INDEX IF NOT EXISTS idx_user_worklist_archived
    ON user_worklist_items(user_id, archived_at)
  `).catch(() => {});
}

async function ensureFocusTable() {
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS user_worklist_focus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      focus_date DATE NOT NULL,
      focus_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, focus_date)
    )
  `);
}

// GET /api/my-worklist/today - Get my list (persistent; completed items archived after 24h)
// Query ?archived=1 returns archived items only.
router.get('/today', async (req, res) => {
  try {
    await ensureTable();
    const today = getTodayInCentral();
    const userId = req.user.id;
    const showArchived = req.query.archived === '1' || req.query.archived === 'true';

    if (!showArchived) {
      // Archive items that have been completed for 24+ hours
      await db.runAsync(
        `UPDATE user_worklist_items SET archived_at = completed_at
         WHERE user_id = ? AND is_completed = 1 AND completed_at IS NOT NULL
         AND datetime(completed_at) <= datetime('now', '-24 hours') AND archived_at IS NULL`,
        [userId]
      );
    }

    if (showArchived) {
      const items = await db.allAsync(
        `SELECT * FROM user_worklist_items
         WHERE user_id = ? AND archived_at IS NOT NULL
         ORDER BY archived_at DESC, id DESC`,
        [userId]
      );
      return res.json({
        date: today,
        items,
        summary: { total: items.length, completed: items.length, remaining: 0, progress: 100 },
        archived: true
      });
    }

    const items = await db.allAsync(
      `SELECT * FROM user_worklist_items
       WHERE user_id = ? AND (archived_at IS NULL OR archived_at = '')
       ORDER BY is_completed ASC, sort_order ASC, id ASC`,
      [userId]
    );

    const total = items.length;
    const completed = items.filter(i => i.is_completed === 1).length;

    res.json({
      date: today,
      items,
      summary: {
        total,
        completed,
        remaining: total - completed,
        progress: total > 0 ? Math.round((completed / total) * 100) : 100
      }
    });
  } catch (error) {
    console.error('Get my worklist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/my-worklist/items - Add item (persistent list; item_date = date added)
router.post('/items', async (req, res) => {
  try {
    await ensureTable();
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const today = getTodayInCentral();
    const userId = req.user.id;

    const maxOrder = await db.getAsync(
      'SELECT MAX(sort_order) as max FROM user_worklist_items WHERE user_id = ? AND (archived_at IS NULL OR archived_at = \'\')',
      [userId]
    );
    const sortOrder = (maxOrder?.max || 0) + 1;

    const result = await db.runAsync(
      `INSERT INTO user_worklist_items (user_id, item_date, title, description, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, today, title, description || null, sortOrder]
    );

    const item = await db.getAsync('SELECT * FROM user_worklist_items WHERE id = ?', [result.lastID]);
    res.status(201).json({ item });
  } catch (error) {
    console.error('Add my worklist item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/my-worklist/items/:id/toggle - Toggle item completion (unchecking restores from archive)
router.post('/items/:id/toggle', async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const userId = req.user.id;

    const item = await db.getAsync(
      'SELECT * FROM user_worklist_items WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const newCompleted = item.is_completed === 1 ? 0 : 1;
    const completedAt = newCompleted ? new Date().toISOString() : null;
    const archivedAt = newCompleted ? item.archived_at : null;

    await db.runAsync(
      'UPDATE user_worklist_items SET is_completed = ?, completed_at = ?, archived_at = ? WHERE id = ?',
      [newCompleted, completedAt, archivedAt, id]
    );

    const updated = await db.getAsync('SELECT * FROM user_worklist_items WHERE id = ?', [id]);
    res.json({ item: updated });
  } catch (error) {
    console.error('Toggle my worklist item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/my-worklist/items/:id - Delete item
router.delete('/items/:id', async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const userId = req.user.id;

    const item = await db.getAsync(
      'SELECT * FROM user_worklist_items WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });

    await db.runAsync('DELETE FROM user_worklist_items WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete my worklist item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/my-worklist/focus - Get focus text for today
router.get('/focus', async (req, res) => {
  try {
    await ensureFocusTable();
    const date = req.query.date || getTodayInCentral();
    const userId = req.user.id;

    const row = await db.getAsync(
      'SELECT focus_text FROM user_worklist_focus WHERE user_id = ? AND focus_date = ?',
      [userId, date]
    );
    res.json({ focus_text: row?.focus_text || '' });
  } catch (error) {
    console.error('Get my focus error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/my-worklist/focus - Save focus text
router.post('/focus', async (req, res) => {
  try {
    await ensureFocusTable();
    const { date, focus_text } = req.body;
    const focusDate = date || getTodayInCentral();
    const userId = req.user.id;

    const existing = await db.getAsync(
      'SELECT id FROM user_worklist_focus WHERE user_id = ? AND focus_date = ?',
      [userId, focusDate]
    );

    if (existing) {
      await db.runAsync(
        'UPDATE user_worklist_focus SET focus_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [focus_text || '', existing.id]
      );
    } else {
      await db.runAsync(
        'INSERT INTO user_worklist_focus (user_id, focus_date, focus_text) VALUES (?, ?, ?)',
        [userId, focusDate, focus_text || '']
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Save my focus error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
