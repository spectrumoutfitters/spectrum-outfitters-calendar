import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/updates - Get all active updates (for current user)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all active updates that should be shown (only approved ones)
    const updates = await db.allAsync(`
      SELECT su.*, u.full_name as created_by_name
      FROM system_updates su
      LEFT JOIN users u ON su.created_by = u.id
      WHERE su.is_active = 1 AND (su.is_pending = 0 OR su.is_pending IS NULL)
      ORDER BY su.created_at DESC
    `);

    // Get which updates this user has read
    const readUpdates = await db.allAsync(`
      SELECT update_id, read_at
      FROM system_updates_read
      WHERE user_id = ?
    `, [userId]);

    const readMap = new Map(readUpdates.map(r => [r.update_id, r.read_at]));

    // Add read status to each update
    const updatesWithStatus = updates.map(update => ({
      ...update,
      is_read: readMap.has(update.id),
      read_at: readMap.get(update.id) || null
    }));

    // Count unread updates
    const unreadCount = updatesWithStatus.filter(u => !u.is_read && u.show_on_login === 1).length;

    res.json({
      updates: updatesWithStatus,
      unreadCount
    });
  } catch (error) {
    console.error('Get updates error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/updates/unread - Get unread updates count
router.get('/unread', async (req, res) => {
  try {
    const userId = req.user.id;
    const activeUpdates = await db.allAsync(`
      SELECT id FROM system_updates
      WHERE is_active = 1 AND show_on_login = 1 AND (is_pending = 0 OR is_pending IS NULL)
    `);
    if (activeUpdates.length === 0) {
      return res.json({ unreadCount: 0 });
    }
    const updateIds = activeUpdates.map(u => u.id);
    const readUpdates = await db.allAsync(`
      SELECT update_id FROM system_updates_read
      WHERE user_id = ? AND update_id IN (${updateIds.map(() => '?').join(',')})
    `, [userId, ...updateIds]);
    const readIds = new Set(readUpdates.map(r => r.update_id));
    const unreadCount = activeUpdates.filter(u => !readIds.has(u.id)).length;
    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.json({ unreadCount: 0 });
  }
});

// POST /api/updates/:id/read - Mark update as read
router.post('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if update exists and is active
    const update = await db.getAsync(
      'SELECT id FROM system_updates WHERE id = ? AND is_active = 1',
      [id]
    );

    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }

    // Mark as read (insert or ignore if already read)
    await db.runAsync(`
      INSERT OR IGNORE INTO system_updates_read (update_id, user_id)
      VALUES (?, ?)
    `, [id, userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Mark update as read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/updates/:id/read-all - Mark all updates as read
router.post('/read-all', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all active updates
    const updates = await db.allAsync(
      'SELECT id FROM system_updates WHERE is_active = 1'
    );

    // Mark all as read
    for (const update of updates) {
      await db.runAsync(`
        INSERT OR IGNORE INTO system_updates_read (update_id, user_id)
        VALUES (?, ?)
      `, [update.id, userId]);
    }

    res.json({ success: true, marked: updates.length });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin routes below
// GET /api/updates/admin/all - Get all updates (including inactive and pending) - admin only
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const updates = await db.allAsync(`
      SELECT su.*, u.full_name as created_by_name,
             approver.full_name as approved_by_name,
             (SELECT COUNT(*) FROM system_updates_read WHERE update_id = su.id) as read_count,
             (SELECT COUNT(*) FROM users WHERE is_active = 1) as total_users
      FROM system_updates su
      LEFT JOIN users u ON su.created_by = u.id
      LEFT JOIN users approver ON su.approved_by = approver.id
      ORDER BY 
        CASE WHEN su.is_pending = 1 THEN 0 ELSE 1 END,
        su.created_at DESC
    `);

    res.json({ updates });
  } catch (error) {
    console.error('Get all updates (admin) error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/updates/admin/pending - Get pending updates - admin only
router.get('/admin/pending', requireAdmin, async (req, res) => {
  try {
    const updates = await db.allAsync(`
      SELECT su.*, u.full_name as created_by_name
      FROM system_updates su
      LEFT JOIN users u ON su.created_by = u.id
      WHERE su.is_pending = 1
      ORDER BY su.created_at DESC
    `);

    res.json({ updates });
  } catch (error) {
    console.error('Get pending updates error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/updates/admin - Create new update (starts as pending) - admin only
router.post('/admin', requireAdmin, async (req, res) => {
  try {
    const { title, content, version, update_type, priority, show_on_login, auto_approve } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // New updates start as pending unless auto_approve is true
    const isPending = auto_approve ? 0 : 1;
    const approvedBy = auto_approve ? req.user.id : null;
    const approvedAt = auto_approve ? new Date().toISOString() : null;

    const result = await db.runAsync(`
      INSERT INTO system_updates (title, content, version, update_type, priority, show_on_login, is_pending, approved_by, approved_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title.trim(),
      content.trim(),
      version || null,
      update_type || 'feature',
      priority || 'medium',
      show_on_login !== undefined ? (show_on_login ? 1 : 0) : 1,
      isPending,
      approvedBy,
      approvedAt,
      req.user.id
    ]);

    const newUpdate = await db.getAsync(`
      SELECT su.*, u.full_name as created_by_name,
             approver.full_name as approved_by_name
      FROM system_updates su
      LEFT JOIN users u ON su.created_by = u.id
      LEFT JOIN users approver ON su.approved_by = approver.id
      WHERE su.id = ?
    `, [result.lastID]);

    res.status(201).json({ update: newUpdate });
  } catch (error) {
    console.error('Create update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/updates/admin/:id/approve - Approve pending update - admin only
router.post('/admin/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const update = await db.getAsync('SELECT id, is_pending FROM system_updates WHERE id = ?', [id]);
    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }

    await db.runAsync(`
      UPDATE system_updates
      SET is_pending = 0, approved_by = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.user.id, id]);

    const approved = await db.getAsync(`
      SELECT su.*, u.full_name as created_by_name,
             approver.full_name as approved_by_name
      FROM system_updates su
      LEFT JOIN users u ON su.created_by = u.id
      LEFT JOIN users approver ON su.approved_by = approver.id
      WHERE su.id = ?
    `, [id]);

    res.json({ update: approved });
  } catch (error) {
    console.error('Approve update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/updates/admin/:id/reject - Reject/delete pending update - admin only
router.post('/admin/:id/reject', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM system_updates WHERE id = ? AND is_pending = 1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Reject update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/updates/admin/bulk-approve - Approve multiple updates - admin only
router.post('/admin/bulk-approve', requireAdmin, async (req, res) => {
  try {
    const { update_ids } = req.body;
    
    if (!Array.isArray(update_ids) || update_ids.length === 0) {
      return res.status(400).json({ error: 'update_ids array is required' });
    }

    const placeholders = update_ids.map(() => '?').join(',');
    await db.runAsync(`
      UPDATE system_updates
      SET is_pending = 0, approved_by = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders}) AND is_pending = 1
    `, [req.user.id, ...update_ids]);

    res.json({ success: true, approved: update_ids.length });
  } catch (error) {
    console.error('Bulk approve error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/updates/admin/:id - Update existing update - admin only
router.put('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, version, update_type, priority, is_active, show_on_login } = req.body;

    const update = await db.getAsync('SELECT id FROM system_updates WHERE id = ?', [id]);
    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }

    await db.runAsync(`
      UPDATE system_updates
      SET title = ?, content = ?, version = ?, update_type = ?, priority = ?,
          is_active = ?, show_on_login = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title?.trim() || update.title,
      content?.trim() || update.content,
      version || null,
      update_type || 'feature',
      priority || 'medium',
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      show_on_login !== undefined ? (show_on_login ? 1 : 0) : 1,
      id
    ]);

    const updated = await db.getAsync(`
      SELECT su.*, u.full_name as created_by_name
      FROM system_updates su
      LEFT JOIN users u ON su.created_by = u.id
      WHERE su.id = ?
    `, [id]);

    res.json({ update: updated });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/updates/admin/:id - Delete update - admin only
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM system_updates WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
