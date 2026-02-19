import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

function getTodayInCentral() {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
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
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.runAsync(`
    CREATE INDEX IF NOT EXISTS idx_user_worklist_user_date
    ON user_worklist_items(user_id, item_date)
  `);
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

// GET /api/my-worklist/today - Get my items for today
router.get('/today', async (req, res) => {
  try {
    await ensureTable();
    const today = getTodayInCentral();
    const userId = req.user.id;

    const items = await db.allAsync(
      `SELECT * FROM user_worklist_items
       WHERE user_id = ? AND item_date = ?
       ORDER BY is_completed ASC, sort_order ASC, id ASC`,
      [userId, today]
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

// POST /api/my-worklist/items - Add item for today
router.post('/items', async (req, res) => {
  try {
    await ensureTable();
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const today = getTodayInCentral();
    const userId = req.user.id;

    const maxOrder = await db.getAsync(
      'SELECT MAX(sort_order) as max FROM user_worklist_items WHERE user_id = ? AND item_date = ?',
      [userId, today]
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

// POST /api/my-worklist/items/:id/toggle - Toggle item completion
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

    await db.runAsync(
      'UPDATE user_worklist_items SET is_completed = ?, completed_at = ? WHERE id = ?',
      [newCompleted, completedAt, id]
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
