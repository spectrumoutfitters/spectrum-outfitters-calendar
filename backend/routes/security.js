import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/admin/security/active-sessions
// Returns DB sessions enriched with "online", and merges in anyone currently in connectedUsers
// so you always see who is connected via Socket.io even if DB session rows are missing.
router.get('/active-sessions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let sessions = [];
    try {
      sessions = await db.allAsync(`
        SELECT
          s.id, s.user_id, s.started_at, s.last_seen_at, s.ip, s.user_agent, s.socket_id,
          u.username, u.full_name, u.role
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.active = 1
        ORDER BY s.last_seen_at DESC
      `);
    } catch (dbErr) {
      // Tables might not exist yet on first deploy
    }

    const connectedUsers = req.app.get('connectedUsers') || new Map();
    const onlineIds = new Set([...connectedUsers.keys()]);

    const enriched = sessions.map(s => ({
      ...s,
      online: onlineIds.has(s.user_id)
    }));

    // Include everyone currently connected via Socket.io who isn't already in the list
    const seenIds = new Set(enriched.map(s => s.user_id));
    for (const [userId, info] of connectedUsers) {
      if (seenIds.has(userId)) continue;
      seenIds.add(userId);
      let full_name = info.userFullName;
      let role = 'employee';
      try {
        const u = await db.getAsync('SELECT full_name, role FROM users WHERE id = ?', [userId]);
        if (u) {
          full_name = u.full_name;
          role = u.role;
        }
      } catch (_) {}
      enriched.unshift({
        id: null,
        user_id: userId,
        started_at: null,
        last_seen_at: new Date().toISOString(),
        ip: info.ip || null,
        user_agent: null,
        socket_id: info.socketId,
        username: info.userName,
        full_name: full_name || info.userFullName,
        role,
        online: true
      });
    }

    res.json({ sessions: enriched });
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/security/login-events?from=&to=&user_id=&success=&limit=&offset=
router.get('/login-events', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { from, to, user_id, success, limit = 100, offset = 0 } = req.query;
    const conditions = [];
    const params = [];

    if (from) {
      conditions.push('le.occurred_at >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('le.occurred_at <= ?');
      params.push(to);
    }
    if (user_id) {
      conditions.push('le.user_id = ?');
      params.push(parseInt(user_id, 10));
    }
    if (success !== undefined && success !== '') {
      conditions.push('le.success = ?');
      params.push(parseInt(success, 10));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await db.getAsync(
      `SELECT COUNT(*) as total FROM login_events le ${where}`, params
    );

    const events = await db.allAsync(`
      SELECT
        le.*,
        u.full_name, u.role
      FROM login_events le
      LEFT JOIN users u ON le.user_id = u.id
      ${where}
      ORDER BY le.occurred_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

    res.json({ events, total: countRow?.total || 0 });
  } catch (error) {
    console.error('Error fetching login events:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/security/session-history?user_id=&limit=&offset=
router.get('/session-history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { user_id, limit = 100, offset = 0 } = req.query;
    const conditions = [];
    const params = [];

    if (user_id) {
      conditions.push('s.user_id = ?');
      params.push(parseInt(user_id, 10));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sessions = await db.allAsync(`
      SELECT
        s.*,
        u.username, u.full_name, u.role
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      ${where}
      ORDER BY s.started_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

    res.json({ sessions });
  } catch (error) {
    console.error('Error fetching session history:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/security/on-prem-config
router.get('/on-prem-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const ipRow = await db.getAsync("SELECT value FROM app_settings WHERE key = 'on_prem_allowed_ips'");
    const geoRow = await db.getAsync("SELECT value FROM app_settings WHERE key = 'on_prem_geofence'");

    res.json({
      allowedIPs: ipRow?.value ? JSON.parse(ipRow.value) : [],
      geofence: geoRow?.value ? JSON.parse(geoRow.value) : null
    });
  } catch (error) {
    console.error('Error fetching on-prem config:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/security/on-prem-config
router.put('/on-prem-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { allowedIPs, geofence } = req.body;

    if (allowedIPs !== undefined) {
      if (!Array.isArray(allowedIPs)) {
        return res.status(400).json({ error: 'allowedIPs must be an array of IP strings or CIDRs' });
      }
      await db.runAsync(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('on_prem_allowed_ips', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(allowedIPs)]
      );
    }

    if (geofence !== undefined) {
      if (geofence !== null) {
        if (typeof geofence !== 'object' || geofence.lat == null || geofence.lng == null || geofence.radiusMeters == null) {
          return res.status(400).json({ error: 'geofence must be { lat, lng, radiusMeters } or null' });
        }
      }
      await db.runAsync(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('on_prem_geofence', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [geofence ? JSON.stringify(geofence) : null]
      );
    }

    const ipRow = await db.getAsync("SELECT value FROM app_settings WHERE key = 'on_prem_allowed_ips'");
    const geoRow = await db.getAsync("SELECT value FROM app_settings WHERE key = 'on_prem_geofence'");

    res.json({
      allowedIPs: ipRow?.value ? JSON.parse(ipRow.value) : [],
      geofence: geoRow?.value ? JSON.parse(geoRow.value) : null
    });
  } catch (error) {
    console.error('Error updating on-prem config:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/security/login-events - purge old events (retention)
router.delete('/login-events', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { olderThanDays = 90 } = req.query;
    const result = await db.runAsync(
      `DELETE FROM login_events WHERE occurred_at < datetime('now', '-' || ? || ' days')`,
      [parseInt(olderThanDays, 10)]
    );
    res.json({ deleted: result.changes });
  } catch (error) {
    console.error('Error purging login events:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/security/stats - quick overview numbers
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [activeSessions, today, failed24h, uniqueIPs] = await Promise.all([
      db.getAsync('SELECT COUNT(*) as count FROM user_sessions WHERE active = 1'),
      db.getAsync("SELECT COUNT(*) as count FROM login_events WHERE occurred_at >= date('now') AND success = 1"),
      db.getAsync("SELECT COUNT(*) as count FROM login_events WHERE occurred_at >= datetime('now', '-24 hours') AND success = 0"),
      db.getAsync("SELECT COUNT(DISTINCT ip) as count FROM login_events WHERE occurred_at >= date('now')")
    ]);

    res.json({
      activeSessions: activeSessions?.count || 0,
      loginsToday: today?.count || 0,
      failedLast24h: failed24h?.count || 0,
      uniqueIPsToday: uniqueIPs?.count || 0
    });
  } catch (error) {
    console.error('Error fetching security stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
