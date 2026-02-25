import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { optimizeSchedule, isAIEnabled } from '../utils/aiService.js';
import {
  pushEventToGoogle,
  deleteEventFromGoogle,
  shouldSyncEntryToGoogle,
  listCalendars,
  getGoogleCalendarConfig
} from '../utils/googleCalendarService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/schedule/visibility - Get schedule visibility setting (what employees see)
router.get('/visibility', async (req, res) => {
  try {
    const row = await db.getAsync("SELECT value FROM app_settings WHERE key = 'schedule_employees_see_all'");
    const employeesSeeAll = row?.value === '1' || row?.value === 'true';
    res.json({ employeesSeeAll: !!employeesSeeAll });
  } catch (error) {
    console.error('Get schedule visibility error:', error);
    res.json({ employeesSeeAll: false });
  }
});

// PUT /api/schedule/visibility - Set schedule visibility for employees (admin only)
router.put('/visibility', requireAdmin, async (req, res) => {
  try {
    const { employeesSeeAll } = req.body ?? {};
    const value = employeesSeeAll === true || employeesSeeAll === 'true' ? '1' : '0';
    await db.runAsync(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('schedule_employees_see_all', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [value]
    );
    res.json({ employeesSeeAll: value === '1' });
  } catch (error) {
    console.error('Set schedule visibility error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/schedule - Get schedule entries
// Admin can see all; employees see all or only own+shop-wide based on schedule_employees_see_all
router.get('/', async (req, res) => {
  try {
    try {
      await db.allAsync('SELECT 1 FROM schedule_entries LIMIT 1');
    } catch (tableError) {
      console.error('Schedule table missing:', tableError.message);
      return res.json({ entries: [] });
    }

    const { user_id, start_date, end_date } = req.query;
    const isAdmin = req.user.role === 'admin';
    
    let query = `
      SELECT 
        se.*,
        CASE 
          WHEN se.is_shop_wide = 1 THEN 'Shop Closed'
          WHEN u.full_name IS NOT NULL THEN u.full_name
          WHEN se.organizer_display_name IS NOT NULL AND TRIM(se.organizer_display_name) != '' THEN se.organizer_display_name
          ELSE 'Unknown User'
        END as user_name,
        CASE 
          WHEN se.is_shop_wide = 1 THEN 'shop'
          WHEN u.username IS NOT NULL THEN u.username
          WHEN se.organizer_display_name IS NOT NULL AND TRIM(se.organizer_display_name) != '' THEN LOWER(REPLACE(TRIM(se.organizer_display_name), ' ', '_'))
          ELSE 'unknown'
        END as username,
        creator.full_name as created_by_name,
        approver.full_name as approved_by_name
      FROM schedule_entries se
      LEFT JOIN users u ON se.user_id = u.id AND (se.is_shop_wide IS NULL OR se.is_shop_wide = 0)
      LEFT JOIN users creator ON se.created_by = creator.id
      LEFT JOIN users approver ON se.approved_by = approver.id
      WHERE (se.is_shop_wide = 1 OR se.is_shop_wide IS NULL OR se.is_shop_wide = 0)
    `;
    const params = [];

    // If not admin, apply visibility setting: either full schedule or only own + shop-wide
    if (!isAdmin) {
      let employeesSeeAll = false;
      try {
        const row = await db.getAsync("SELECT value FROM app_settings WHERE key = 'schedule_employees_see_all'");
        employeesSeeAll = row?.value === '1' || row?.value === 'true';
      } catch (_) {}
      if (!employeesSeeAll) {
        query += ' AND (se.user_id = ? OR se.is_shop_wide = 1)';
        params.push(req.user.id);
      }
    } else if (user_id && user_id !== 'all') {
      // Admin can filter by user (but still show shop-wide entries)
      query += ' AND (se.user_id = ? OR se.is_shop_wide = 1)';
      params.push(user_id);
    }
    // If admin selects "all", show everything (no filter)

    if (start_date) {
      query += ' AND se.end_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND se.start_date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY se.start_date ASC, se.created_at DESC';

    console.log('Schedule query:', query);
    console.log('Schedule params:', params);
    
    try {
      const entries = await db.allAsync(query, params);
      console.log(`Found ${entries.length} schedule entries`);

      let calendar_names = {};
      try {
        const cfg = await getGoogleCalendarConfig();
        const syncIdsRaw = cfg?.sync_calendar_ids;
        const syncIds = (() => {
          if (!syncIdsRaw || typeof syncIdsRaw !== 'string') return [];
          try {
            const p = JSON.parse(syncIdsRaw);
            return Array.isArray(p) ? p : [];
          } catch (_) { return []; }
        })();
        if (syncIds.length > 0) {
          const calendars = await listCalendars();
          for (const c of calendars || []) {
            if (c.id && syncIds.includes(c.id)) calendar_names[c.id] = c.summary || c.id;
          }
        }
      } catch (_) {}

      res.json({ entries, calendar_names });
    } catch (queryError) {
      console.error('Query execution error:', queryError);
      console.error('Query:', query);
      console.error('Params:', params);
      throw queryError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('Get schedule entries error:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
    console.error('Query that failed:', query);
    console.error('Params that failed:', params);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// GET /api/schedule/entry/:id - Fetch a single entry (for linking from dashboard; same visibility as GET /)
router.get('/entry/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const isAdmin = req.user.role === 'admin';
    let query = `
      SELECT 
        se.*,
        CASE 
          WHEN se.is_shop_wide = 1 THEN 'Shop Closed'
          WHEN u.full_name IS NOT NULL THEN u.full_name
          WHEN se.organizer_display_name IS NOT NULL AND TRIM(se.organizer_display_name) != '' THEN se.organizer_display_name
          ELSE 'Unknown User'
        END as user_name,
        CASE 
          WHEN se.is_shop_wide = 1 THEN 'shop'
          WHEN u.username IS NOT NULL THEN u.username
          WHEN se.organizer_display_name IS NOT NULL AND TRIM(se.organizer_display_name) != '' THEN LOWER(REPLACE(TRIM(se.organizer_display_name), ' ', '_'))
          ELSE 'unknown'
        END as username,
        creator.full_name as created_by_name,
        approver.full_name as approved_by_name
      FROM schedule_entries se
      LEFT JOIN users u ON se.user_id = u.id AND (se.is_shop_wide IS NULL OR se.is_shop_wide = 0)
      LEFT JOIN users creator ON se.created_by = creator.id
      LEFT JOIN users approver ON se.approved_by = approver.id
      WHERE se.id = ?
    `;
    const params = [id];
    if (!isAdmin) {
      let employeesSeeAll = false;
      try {
        const row = await db.getAsync("SELECT value FROM app_settings WHERE key = 'schedule_employees_see_all'");
        employeesSeeAll = row?.value === '1' || row?.value === 'true';
      } catch (_) {}
      if (!employeesSeeAll) {
        query += ' AND (se.user_id = ? OR se.is_shop_wide = 1)';
        params.push(req.user.id);
      }
    }
    const entry = await db.getAsync(query, params);
    if (!entry) return res.status(404).json({ error: 'Schedule entry not found' });
    res.json({ entry });
  } catch (err) {
    console.error('Get schedule entry error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// POST /api/schedule - Create schedule entry
// Admins can create for anyone or shop-wide closed days, employees can only create requests for themselves
router.post('/', async (req, res) => {
  try {
    const { user_id, start_date, end_date, type, reason, notes, location, is_shop_wide, is_event, google_calendar_id } = req.body;
    const isAdmin = req.user.role === 'admin';

    // Ensure push_calendar_id and location columns exist (idempotent)
    try {
      const cols = await db.allAsync('PRAGMA table_info(schedule_entries)');
      if (!cols.some((c) => c.name === 'push_calendar_id')) {
        await db.runAsync('ALTER TABLE schedule_entries ADD COLUMN push_calendar_id TEXT');
      }
      if (!cols.some((c) => c.name === 'location')) {
        await db.runAsync('ALTER TABLE schedule_entries ADD COLUMN location TEXT');
      }
      if (!cols.some((c) => c.name === 'source_calendar_id')) {
        await db.runAsync('ALTER TABLE schedule_entries ADD COLUMN source_calendar_id TEXT');
      }
    } catch (_) {}

    // Determine which user this is for
    let targetUserId;
    let shopWide = is_shop_wide === true || is_shop_wide === 1;
    
    if (shopWide) {
      // Shop-wide closed days - only admins can create these
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only admins can create shop-wide closed days' });
      }
      targetUserId = null; // Use NULL for shop-wide entries (no foreign key constraint)
    } else if (isAdmin) {
      // Admin can create for any user, or for themselves if user_id is not provided
      targetUserId = user_id || req.user.id;
    } else {
      // Employees can only create requests for themselves
      targetUserId = req.user.id;
    }

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Validate dates
    const start = new Date(start_date);
    const end = new Date(end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    if (end < start) {
      return res.status(400).json({ error: 'end_date must be after start_date' });
    }

    // Check for overlapping entries
    // Shop-wide entries can overlap with individual entries (they're separate concerns)
    // Individual entries should only check for overlaps with other individual entries for the same user
    let overlappingQuery;
    let overlappingParams;
    
    if (shopWide) {
      // Shop-wide entries - only check for overlaps with other shop-wide entries
      overlappingQuery = `
        SELECT * FROM schedule_entries
        WHERE is_shop_wide = 1
        AND (
          (start_date <= ? AND end_date >= ?)
          OR (start_date <= ? AND end_date >= ?)
          OR (start_date >= ? AND end_date <= ?)
        )
        AND status != 'rejected'
      `;
      overlappingParams = [start_date, start_date, end_date, end_date, start_date, end_date];
    } else {
      // Individual entries - only check for overlaps with this user's OTHER individual entries
      // (Shop-wide entries don't block individual entries - they're separate)
      overlappingQuery = `
        SELECT * FROM schedule_entries
        WHERE user_id = ?
        AND (is_shop_wide IS NULL OR is_shop_wide = 0)
        AND (
          (start_date <= ? AND end_date >= ?)
          OR (start_date <= ? AND end_date >= ?)
          OR (start_date >= ? AND end_date <= ?)
        )
        AND status != 'rejected'
      `;
      overlappingParams = [targetUserId, start_date, start_date, end_date, end_date, start_date, end_date];
    }
    
    const overlapping = await db.allAsync(overlappingQuery, overlappingParams);

    if (overlapping.length > 0) {
      return res.status(400).json({ 
        error: 'Schedule entry overlaps with existing entry',
        overlapping: overlapping
      });
    }

    // Determine type and status based on who's creating it
    const isEvent = is_event === true || is_event === 'true' || is_event === 1;
    const eventTypes = ['meeting', 'training', 'other', 'appointment', 'workshop', 'conference'];
    let entryType = type || (isAdmin ? 'day_off' : 'time_off_request');
    let entryStatus = isAdmin ? 'scheduled' : 'pending'; // Employee requests need approval

    // Employees can add "events" (meeting/training/other) that go on the calendar immediately
    if (!isAdmin && isEvent) {
      entryType = eventTypes.includes(entryType) ? entryType : 'meeting';
      entryStatus = 'scheduled';
    }

    const pushCalendarId = isAdmin && google_calendar_id && typeof google_calendar_id === 'string' && google_calendar_id.trim()
      ? google_calendar_id.trim()
      : null;

    const locationStr = typeof location === 'string' ? location.trim() || null : null;
    const result = await db.runAsync(`
      INSERT INTO schedule_entries 
      (user_id, start_date, end_date, type, status, reason, notes, location, created_by, is_shop_wide, push_calendar_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      targetUserId,
      start_date,
      end_date,
      entryType,
      entryStatus,
      reason || null,
      notes || null,
      locationStr,
      req.user.id,
      shopWide ? 1 : 0,
      pushCalendarId
    ]);

    const entry = await db.getAsync(`
      SELECT 
        se.*,
        CASE 
          WHEN se.is_shop_wide = 1 THEN 'Shop Closed'
          WHEN u.full_name IS NOT NULL THEN u.full_name
          WHEN se.organizer_display_name IS NOT NULL AND TRIM(se.organizer_display_name) != '' THEN se.organizer_display_name
          ELSE 'Unknown User'
        END as user_name,
        CASE 
          WHEN se.is_shop_wide = 1 THEN 'shop'
          WHEN u.username IS NOT NULL THEN u.username
          WHEN se.organizer_display_name IS NOT NULL AND TRIM(se.organizer_display_name) != '' THEN LOWER(REPLACE(TRIM(se.organizer_display_name), ' ', '_'))
          ELSE 'unknown'
        END as username,
        creator.full_name as created_by_name
      FROM schedule_entries se
      LEFT JOIN users u ON se.user_id = u.id AND (se.is_shop_wide IS NULL OR se.is_shop_wide = 0)
      LEFT JOIN users creator ON se.created_by = creator.id
      WHERE se.id = ?
    `, [result.lastID]);

    // Sync to Google Calendar (best-effort; never blocks local creation)
    if (shouldSyncEntryToGoogle(entry)) {
      try {
        const sync = await pushEventToGoogle(entry);
        if (sync?.google_event_id) {
          const sourceCalId = entry.push_calendar_id || null;
          await db.runAsync(
            `UPDATE schedule_entries SET google_event_id = ?, source_calendar_id = ?, last_synced_at = ? WHERE id = ?`,
            [sync.google_event_id, sourceCalId, new Date().toISOString(), entry.id]
          ).catch(() => {});
          entry.google_event_id = sync.google_event_id;
          entry.source_calendar_id = sourceCalId;
          entry.last_synced_at = new Date().toISOString();
        }
      } catch (syncErr) {
        console.warn('Google Calendar sync (create) failed:', syncErr?.message || syncErr);
      }
    }

    // Send notification to admins if this is a pending request
    const requestTypes = ['time_off_request', 'out_of_office', 'vacation', 'sick_leave', 'personal_leave', 'training', 'meeting', 'other'];
    if (entryStatus === 'pending' && requestTypes.includes(entryType)) {
      const io = req.app.get('io');
      
      if (io) {
        try {
          // Get the user who created the request
          const requestingUser = await db.getAsync(
            'SELECT full_name, username FROM users WHERE id = ?',
            [req.user.id]
          );
          
          // Format dates for notification
          const startDate = new Date(start_date).toLocaleDateString('en-US', { 
            month: 'short', day: 'numeric', year: 'numeric' 
          });
          const endDate = new Date(end_date).toLocaleDateString('en-US', { 
            month: 'short', day: 'numeric', year: 'numeric' 
          });
          
          const dateRange = start_date === end_date ? startDate : `${startDate} - ${endDate}`;
          const reasonText = reason ? ` (Reason: ${reason})` : '';
          
          const typeLabels = {
            'time_off_request': 'Time Off',
            'out_of_office': 'Out of Office',
            'vacation': 'Vacation',
            'sick_leave': 'Sick Leave',
            'personal_leave': 'Personal Leave',
            'training': 'Training',
            'meeting': 'Meeting',
            'other': 'Other'
          };
          const typeLabel = typeLabels[entryType] || 'Time Off';
          const notificationMessage = `📅 ${typeLabel} Request: ${requestingUser.full_name || requestingUser.username} has requested ${typeLabel.toLowerCase()} for ${dateRange}${reasonText}`;
          
          // Send admin board message so only admins see it
          const messageResult = await db.runAsync(
            `INSERT INTO messages (sender_id, message, is_team_message, board_type) 
             VALUES (?, ?, 1, 'admin_board')`,
            [req.user.id, notificationMessage]
          );

          const messageData = await db.getAsync(
            `SELECT m.*, u.full_name as sender_name 
             FROM messages m 
             JOIN users u ON m.sender_id = u.id 
             WHERE m.id = ?`,
            [messageResult.lastID]
          );

          // Emit to admin room only
          io.to('admin_room').emit('new_message', messageData);
          
          console.log(`✅ Time off request notification sent to admins for ${requestingUser.full_name || requestingUser.username}`);
        } catch (notifError) {
          console.error('Error sending time off request notification:', notifError);
          // Don't fail the request creation if notification fails
        }
      }
    }

    res.status(201).json({ entry });
  } catch (error) {
    console.error('Create schedule entry error:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// PUT /api/schedule/:id - Update schedule entry
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, type, reason, notes, location, status, is_shop_wide } = req.body;

    const currentEntry = await db.getAsync('SELECT * FROM schedule_entries WHERE id = ?', [id]);
    if (!currentEntry) {
      return res.status(404).json({ error: 'Schedule entry not found' });
    }

    // Validate dates if provided
    if (start_date && end_date) {
      const start = new Date(start_date);
      const end = new Date(end_date);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      if (end < start) {
        return res.status(400).json({ error: 'end_date must be after start_date' });
      }

      // Check for overlapping entries (excluding current entry)
      const overlapping = await db.allAsync(`
        SELECT * FROM schedule_entries
        WHERE user_id = ?
        AND id != ?
        AND (
          (start_date <= ? AND end_date >= ?)
          OR (start_date <= ? AND end_date >= ?)
          OR (start_date >= ? AND end_date <= ?)
        )
        AND status != 'rejected'
      `, [currentEntry.user_id, id, start_date, start_date, end_date, end_date, start_date, end_date]);

      if (overlapping.length > 0) {
        return res.status(400).json({ 
          error: 'Schedule entry overlaps with existing entry',
          overlapping: overlapping
        });
      }
    }

    // Build update query dynamically based on what's provided
    const updates = [];
    const updateParams = [];
    
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      updateParams.push(start_date);
    }
    if (end_date !== undefined) {
      updates.push('end_date = ?');
      updateParams.push(end_date);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      updateParams.push(type);
    }
    if (reason !== undefined) {
      updates.push('reason = ?');
      updateParams.push(reason);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      updateParams.push(notes);
    }
    if (location !== undefined) {
      updates.push('location = ?');
      updateParams.push(typeof location === 'string' ? location.trim() || null : null);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      updateParams.push(status);
    }
    if (is_shop_wide !== undefined) {
      updates.push('is_shop_wide = ?');
      updateParams.push(is_shop_wide ? 1 : 0);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(id);
    
    if (updates.length === 1) {
      // Only updated_at, nothing to update
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    await db.runAsync(`
      UPDATE schedule_entries
      SET ${updates.join(', ')}
      WHERE id = ?
    `, updateParams);

    const updatedEntry = await db.getAsync(`
      SELECT 
        se.*,
        CASE 
          WHEN se.is_shop_wide = 1 THEN 'Shop Closed'
          WHEN u.full_name IS NOT NULL THEN u.full_name
          WHEN se.organizer_display_name IS NOT NULL AND TRIM(se.organizer_display_name) != '' THEN se.organizer_display_name
          ELSE 'Unknown User'
        END as user_name,
        CASE 
          WHEN se.is_shop_wide = 1 THEN 'shop'
          WHEN u.username IS NOT NULL THEN u.username
          WHEN se.organizer_display_name IS NOT NULL AND TRIM(se.organizer_display_name) != '' THEN LOWER(REPLACE(TRIM(se.organizer_display_name), ' ', '_'))
          ELSE 'unknown'
        END as username,
        creator.full_name as created_by_name,
        approver.full_name as approved_by_name
      FROM schedule_entries se
      LEFT JOIN users u ON se.user_id = u.id AND (se.is_shop_wide IS NULL OR se.is_shop_wide = 0)
      LEFT JOIN users creator ON se.created_by = creator.id
      LEFT JOIN users approver ON se.approved_by = approver.id
      WHERE se.id = ?
    `, [id]);

    // Sync to Google Calendar (best-effort; never blocks local update)
    if (shouldSyncEntryToGoogle(updatedEntry)) {
      try {
        const sync = await pushEventToGoogle(updatedEntry);
        if (sync?.google_event_id) {
          await db.runAsync(
            `UPDATE schedule_entries SET google_event_id = ?, last_synced_at = ? WHERE id = ?`,
            [sync.google_event_id, new Date().toISOString(), updatedEntry.id]
          ).catch(() => {});
          updatedEntry.google_event_id = sync.google_event_id;
          updatedEntry.last_synced_at = new Date().toISOString();
        }
      } catch (syncErr) {
        console.warn('Google Calendar sync (update) failed:', syncErr?.message || syncErr);
      }
    } else {
      // If it was previously synced but is no longer eligible (e.g. rejected/pending),
      // we leave the Google event as-is (admin can delete/edit if desired).
    }

    res.json({ entry: updatedEntry });
  } catch (error) {
    console.error('Update schedule entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/schedule/:id - Delete schedule entry
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await db.getAsync('SELECT * FROM schedule_entries WHERE id = ?', [id]);
    if (!entry) {
      return res.status(404).json({ error: 'Schedule entry not found' });
    }

    await db.runAsync('DELETE FROM schedule_entries WHERE id = ?', [id]);

    // Sync delete to Google Calendar (best-effort)
    if (entry.google_event_id) {
      try {
        await deleteEventFromGoogle(entry.google_event_id);
      } catch (syncErr) {
        console.warn('Google Calendar sync (delete) failed:', syncErr?.message || syncErr);
      }
    }
    res.json({ message: 'Schedule entry deleted' });
  } catch (error) {
    console.error('Delete schedule entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/schedule/:id/approve - Approve time off request (for future employee requests)
router.post('/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body; // true to approve, false to reject

    const entry = await db.getAsync('SELECT * FROM schedule_entries WHERE id = ?', [id]);
    if (!entry) {
      return res.status(404).json({ error: 'Schedule entry not found' });
    }

    // Allow approval/rejection for any request type that's pending
    // (time_off_request, out_of_office, vacation, sick_leave, personal_leave, training, meeting, other)
    const requestTypes = ['time_off_request', 'out_of_office', 'vacation', 'sick_leave', 'personal_leave', 'training', 'meeting', 'other'];
    if (!requestTypes.includes(entry.type)) {
      return res.status(400).json({ error: 'Only request types can be approved/rejected' });
    }

    const newStatus = approved ? 'approved' : 'rejected';
    const newType = approved ? 'approved_time_off' : entry.type;

    await db.runAsync(`
      UPDATE schedule_entries
      SET 
        status = ?,
        type = ?,
        approved_by = ?,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newStatus, newType, req.user.id, id]);

    const updatedEntry = await db.getAsync(`
      SELECT 
        se.*,
        u.full_name as user_name,
        u.username,
        creator.full_name as created_by_name,
        approver.full_name as approved_by_name
      FROM schedule_entries se
      JOIN users u ON se.user_id = u.id
      LEFT JOIN users creator ON se.created_by = creator.id
      LEFT JOIN users approver ON se.approved_by = approver.id
      WHERE se.id = ?
    `, [id]);

    // Sync approval result to Google Calendar (best-effort)
    if (approved) {
      if (shouldSyncEntryToGoogle(updatedEntry)) {
        try {
          const sync = await pushEventToGoogle(updatedEntry);
          if (sync?.google_event_id) {
            await db.runAsync(
              `UPDATE schedule_entries SET google_event_id = ?, last_synced_at = ? WHERE id = ?`,
              [sync.google_event_id, new Date().toISOString(), updatedEntry.id]
            ).catch(() => {});
            updatedEntry.google_event_id = sync.google_event_id;
            updatedEntry.last_synced_at = new Date().toISOString();
          }
        } catch (syncErr) {
          console.warn('Google Calendar sync (approve) failed:', syncErr?.message || syncErr);
        }
      }
    } else {
      // If rejected and it was previously synced, delete the Google event (best-effort)
      if (updatedEntry?.google_event_id) {
        try {
          await deleteEventFromGoogle(updatedEntry.google_event_id);
        } catch (syncErr) {
          console.warn('Google Calendar sync (reject delete) failed:', syncErr?.message || syncErr);
        }
      }
    }

    // Send notification to the employee about the decision
    const io = req.app.get('io');
    
    if (io) {
      try {
        // Format dates for notification
        const startDate = new Date(entry.start_date).toLocaleDateString('en-US', { 
          month: 'short', day: 'numeric', year: 'numeric' 
        });
        const endDate = new Date(entry.end_date).toLocaleDateString('en-US', { 
          month: 'short', day: 'numeric', year: 'numeric' 
        });
        
        const dateRange = entry.start_date === entry.end_date ? startDate : `${startDate} - ${endDate}`;
        const statusEmoji = approved ? '✅' : '❌';
        const statusText = approved ? 'approved' : 'rejected';
        
        const typeLabels = {
          'time_off_request': 'Time Off',
          'out_of_office': 'Out of Office',
          'vacation': 'Vacation',
          'sick_leave': 'Sick Leave',
          'personal_leave': 'Personal Leave',
          'training': 'Training',
          'meeting': 'Meeting',
          'other': 'Other'
        };
        const typeLabel = typeLabels[entry.type] || 'Time Off';
        const notificationMessage = `${statusEmoji} ${typeLabel} Request ${statusText.toUpperCase()}: Your ${typeLabel.toLowerCase()} request for ${dateRange} has been ${statusText} by ${updatedEntry.approved_by_name || 'Admin'}.`;
        
        // Send to team board so the employee sees it
        const messageResult = await db.runAsync(
          `INSERT INTO messages (sender_id, message, is_team_message, board_type) 
           VALUES (?, ?, 1, 'team_board')`,
          [req.user.id, notificationMessage]
        );

        const messageData = await db.getAsync(
          `SELECT m.*, u.full_name as sender_name 
           FROM messages m 
           JOIN users u ON m.sender_id = u.id 
           WHERE m.id = ?`,
          [messageResult.lastID]
        );

        // Emit to team room so employee sees it
        io.to('team_room').emit('new_message', messageData);
        
        console.log(`✅ Time off decision notification sent to ${updatedEntry.user_name}`);
      } catch (notifError) {
        console.error('Error sending time off decision notification:', notifError);
        // Don't fail the approval if notification fails
      }
    }

    res.json({ entry: updatedEntry });
  } catch (error) {
    console.error('Approve schedule entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/schedule/optimize - AI-powered schedule optimization
router.post('/optimize', requireAdmin, async (req, res) => {
  try {
    if (!(await isAIEnabled())) {
      return res.status(400).json({ error: 'AI is not enabled. Configure Claude API key or set up local Ollama.' });
    }

    // Get all active tasks
    const tasks = await db.allAsync(`
      SELECT t.*, 
             u1.full_name as assigned_to_name,
             u2.full_name as created_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.status NOT IN ('completed', 'archived')
      ORDER BY t.priority DESC, t.due_date ASC
    `);

    // Get schedule entries
    const schedule = await db.allAsync(`
      SELECT se.*, u.full_name as user_name
      FROM schedule_entries se
      LEFT JOIN users u ON se.user_id = u.id
      WHERE se.status IN ('scheduled', 'approved')
      ORDER BY se.start_date ASC
    `);

    // Get all employees
    const employees = await db.allAsync(`
      SELECT id, full_name, role
      FROM users
      WHERE is_active = 1 AND role = 'employee'
    `);

    // Get subtasks for each task
    for (let task of tasks) {
      const subtasks = await db.allAsync(
        'SELECT title FROM task_subtasks WHERE task_id = ?',
        [task.id]
      );
      task.subtasks = subtasks.map(s => s.title);
    }

    const optimization = await optimizeSchedule(tasks, schedule, employees);

    if (!optimization) {
      return res.status(500).json({ error: 'Failed to optimize schedule' });
    }

    res.json(optimization);
  } catch (error) {
    console.error('Schedule optimization error:', error);
    res.status(500).json({ error: error.message || 'Failed to optimize schedule' });
  }
});

export default router;

