import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// Map DB task status → dispatch display status
const toDispatchStatus = (dbStatus) => {
  if (dbStatus === 'todo') return 'received';
  if (dbStatus === 'in_progress') return 'in_progress';
  if (dbStatus === 'review') return 'ready';
  return dbStatus;
};

// GET /api/admin/dispatch
router.get('/', async (req, res) => {
  try {
    // Jobs: tasks that are active (not completed/archived)
    const jobRows = await db.allAsync(
      `SELECT
         t.id,
         t.title,
         t.status,
         t.priority,
         t.assigned_to,
         u.full_name AS assigned_to_name,
         t.started_at,
         t.created_at,
         t.estimated_time_minutes,
         COUNT(DISTINCT st.id) AS subtask_count,
         SUM(CASE WHEN st.is_completed = 1 THEN 1 ELSE 0 END) AS subtasks_done
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN task_subtasks st ON st.task_id = t.id
       WHERE t.status IN ('todo','in_progress','review')
         AND (t.is_archived IS NULL OR t.is_archived = 0)
       GROUP BY t.id
       ORDER BY
         CASE t.priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END,
         t.created_at ASC`,
      []
    );

    const now = Date.now();
    const jobs = jobRows.map((row) => {
      const elapsedMinutes = row.started_at
        ? Math.floor((now - new Date(row.started_at).getTime()) / 60000)
        : null;

      let progress = 0;
      if (row.subtask_count > 0) {
        progress = Math.round((row.subtasks_done / row.subtask_count) * 100);
      } else if (row.status === 'review') {
        progress = 90;
      } else if (row.status === 'in_progress') {
        if (row.started_at && row.estimated_time_minutes) {
          const elapsed = (now - new Date(row.started_at).getTime()) / 60000;
          progress = Math.min(85, Math.max(25, Math.round((elapsed / row.estimated_time_minutes) * 100)));
        } else {
          progress = 25;
        }
      }

      return {
        id: row.id,
        title: row.title,
        status: toDispatchStatus(row.status),
        db_status: row.status,
        assigned_to_id: row.assigned_to || null,
        assigned_to_name: row.assigned_to_name || null,
        started_at: row.started_at || null,
        elapsed_minutes: elapsedMinutes,
        estimated_hours: row.estimated_time_minutes ? Math.round(row.estimated_time_minutes / 60 * 10) / 10 : null,
        priority: row.priority || 'medium',
        progress,
      };
    });

    // Team: all active employees with their clock-in status and today's hours
    const today = new Date().toISOString().split('T')[0];

    const teamRows = await db.allAsync(
      `SELECT
         u.id,
         u.full_name AS name,
         te_active.id AS active_entry_id,
         te_active.clock_in AS clocked_in_at,
         (
           SELECT COALESCE(SUM(
             (strftime('%s', COALESCE(clock_out, datetime('now'))) - strftime('%s', clock_in)) / 3600.0
             - break_minutes / 60.0
           ), 0)
           FROM time_entries
           WHERE user_id = u.id
             AND date(clock_in) = ?
         ) AS hours_today
       FROM users u
       LEFT JOIN time_entries te_active
         ON te_active.user_id = u.id AND te_active.clock_out IS NULL
       WHERE u.role IN ('admin','employee')
       ORDER BY u.full_name ASC`,
      [today]
    );

    const team = teamRows.map((row) => {
      const clockedIn = !!row.clocked_in_at;
      // Find which job this person is on (most recently started active task)
      const currentJob = clockedIn
        ? jobs.find((j) => j.assigned_to_id === row.id && j.db_status === 'in_progress') || null
        : null;

      return {
        id: row.id,
        name: row.name,
        status: clockedIn ? 'working' : 'away',
        current_job_id: currentJob?.id || null,
        current_job_title: currentJob?.title || null,
        clocked_in_at: row.clocked_in_at || null,
        hours_today: Math.max(0, Math.round((row.hours_today || 0) * 10) / 10),
      };
    });

    res.json({ jobs, team });
  } catch (err) {
    console.error('Dispatch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
