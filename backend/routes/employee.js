import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendPushToAdmins } from '../utils/pushNotifications.js';

const router = express.Router();

router.use(authenticateToken);

const TIME_OFF_TYPES = [
  'day_off',
  'approved_time_off',
  'vacation',
  'sick_leave',
  'personal_leave',
];

// GET /api/employee/upcoming-days-off
// Returns the soonest upcoming time-off entry within the next 14 days,
// plus a flag if the employee just returned from time-off in the last 3 days.
router.get('/upcoming-days-off', async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const in14 = new Date(today);
    in14.setDate(today.getDate() + 14);
    const in14Str = in14.toISOString().split('T')[0];

    const types = TIME_OFF_TYPES.map(() => '?').join(', ');

    // Upcoming: starts today or in future, within 14 days
    const upcoming = await db.getAsync(
      `SELECT start_date, end_date FROM schedule_entries
       WHERE user_id = ?
         AND type IN (${types})
         AND status != 'rejected'
         AND start_date >= ?
         AND start_date <= ?
       ORDER BY start_date ASC
       LIMIT 1`,
      [userId, ...TIME_OFF_TYPES, todayStr, in14Str]
    );

    // Recently returned: end_date was in the last 3 days (before today)
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

    const returned = await db.getAsync(
      `SELECT start_date, end_date FROM schedule_entries
       WHERE user_id = ?
         AND type IN (${types})
         AND status != 'rejected'
         AND end_date >= ?
         AND end_date < ?
       ORDER BY end_date DESC
       LIMIT 1`,
      [userId, ...TIME_OFF_TYPES, threeDaysAgoStr, todayStr]
    );

    let upcomingResult = null;
    if (upcoming) {
      const startDate = new Date(upcoming.start_date);
      startDate.setHours(0, 0, 0, 0);
      const daysRemaining = Math.round((startDate - today) / 86400000);
      upcomingResult = {
        start_date: upcoming.start_date,
        end_date: upcoming.end_date,
        days_remaining: daysRemaining,
      };
    }

    let returnedResult = null;
    if (returned) {
      const endDate = new Date(returned.end_date);
      endDate.setHours(0, 0, 0, 0);
      const daysSince = Math.round((today - endDate) / 86400000);
      returnedResult = {
        start_date: returned.start_date,
        end_date: returned.end_date,
        days_since: daysSince,
      };
    }

    res.json({ upcoming: upcomingResult, recently_returned: returnedResult });
  } catch (err) {
    console.error('upcoming-days-off error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/employee/vacation-checklist
// Notify admins that the employee is preparing for upcoming time off.
router.post('/vacation-checklist', async (req, res) => {
  try {
    const { days_remaining } = req.body ?? {};
    const name = req.user.full_name || req.user.username;

    // Fetch tasks currently in-progress / todo for this user
    let taskCount = 0;
    try {
      const rows = await db.allAsync(
        `SELECT COUNT(*) as cnt FROM tasks
         WHERE assigned_to = ? AND status NOT IN ('completed') AND (is_archived IS NULL OR is_archived = 0)`,
        [req.user.id]
      );
      taskCount = rows?.[0]?.cnt ?? 0;
    } catch (_) {}

    const daysLabel =
      days_remaining === 0
        ? 'today'
        : days_remaining === 1
        ? 'tomorrow'
        : `in ${days_remaining} day${days_remaining !== 1 ? 's' : ''}`;

    const taskNote =
      taskCount > 0
        ? ` — they have ${taskCount} open task${taskCount !== 1 ? 's' : ''} to hand off`
        : '';

    await sendPushToAdmins({
      title: 'Team Member Going on Leave',
      body: `${name} is taking time off ${daysLabel}${taskNote}`,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('vacation-checklist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
