import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { calculateHours, getWeekEndingDate } from '../utils/helpers.js';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// POST /api/time/clock-in - Clock in
router.post('/clock-in', async (req, res) => {
  try {
    const userId = req.user.id;
    const io = req.app.get('io'); // Get Socket.io instance

    // Check if already clocked in
    const activeEntry = await db.getAsync(
      'SELECT * FROM time_entries WHERE user_id = ? AND clock_out IS NULL',
      [userId]
    );

    if (activeEntry) {
      return res.status(400).json({ error: 'Already clocked in' });
    }

    const clockInTime = new Date().toISOString();
    const weekEnding = getWeekEndingDate();

    // Check for previous lunch break entry from TODAY only
    // Only check if there's a lunch break that hasn't been returned from yet
    const today = new Date().toISOString().split('T')[0];
    const previousLunchEntry = await db.getAsync(
      `SELECT te.* FROM time_entries te
       WHERE te.user_id = ? 
       AND te.notes = 'Lunch break' 
       AND te.clock_out IS NOT NULL
       AND DATE(te.clock_out) = ?
       AND NOT EXISTS (
         SELECT 1 FROM time_entries te2 
         WHERE te2.user_id = te.user_id 
         AND te2.clock_in > te.clock_out
         AND (te2.notes IS NULL OR te2.notes != 'Lunch break')
         AND DATE(te2.clock_in) = ?
       )
       ORDER BY te.clock_out DESC 
       LIMIT 1`,
      [userId, today, today]
    );

    let lunchOvertimeMinutes = null;
    if (previousLunchEntry) {
      const lunchOutTime = new Date(previousLunchEntry.clock_out);
      const lunchInTime = new Date(clockInTime);
      const lunchDurationMs = lunchInTime - lunchOutTime;
      const lunchDurationMinutes = Math.floor(lunchDurationMs / (1000 * 60));
      
      // Only check overtime if this is a reasonable lunch duration (within 24 hours)
      // This prevents false alerts when clocking in after weekends/holidays
      // 10-minute buffer: standard is 60 minutes, alert only after 70 minutes
      if (lunchDurationMinutes > 70 && lunchDurationMinutes < 24 * 60) {
        lunchOvertimeMinutes = lunchDurationMinutes - 70;
        
        // Get user info for notification
        const user = await db.getAsync(
          'SELECT full_name, username FROM users WHERE id = ?',
          [userId]
        );
        
        // Get all admin users
        const admins = await db.allAsync(
          'SELECT id FROM users WHERE role = ? AND is_active = 1',
          ['admin']
        );
        
        // Send notification to all admins via Socket.io
        if (io && admins.length > 0) {
          const hours = Math.floor(lunchOvertimeMinutes / 60);
          const minutes = lunchOvertimeMinutes % 60;
          const timeString = hours > 0 
            ? `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`
            : `${minutes} minute${minutes !== 1 ? 's' : ''}`;
          
          const notificationMessage = `⚠️ Lunch Break Alert: ${user.full_name || user.username} took ${timeString} longer than the allowed lunch break (1 hour + 10 minute buffer).`;
          
          // Send admin board message so only admins see it (not visible to employees)
          try {
            const result = await db.runAsync(
              `INSERT INTO messages (sender_id, message, is_team_message, board_type) 
               VALUES (?, ?, 1, 'admin_board')`,
              [userId, notificationMessage]
            );

            const messageData = await db.getAsync(
              `SELECT m.*, u.full_name as sender_name 
               FROM messages m 
               JOIN users u ON m.sender_id = u.id 
               WHERE m.id = ?`,
              [result.lastID]
            );

            if (messageData) {
              // Send to admin room only (not team room)
              io.to('admin').emit('new_message', {
                ...messageData,
                is_team_message: 1,
                board_type: 'admin_board',
                type: 'admin_board'
              });
            }
          } catch (msgError) {
            console.error('Error sending lunch overtime notification:', msgError);
            // Don't fail the clock-in if notification fails
          }
        }
      }
    }

    const result = await db.runAsync(
      'INSERT INTO time_entries (user_id, clock_in, week_ending_date) VALUES (?, ?, ?)',
      [userId, clockInTime, weekEnding]
    );

    const entry = await db.getAsync('SELECT * FROM time_entries WHERE id = ?', [result.lastID]);
    res.status(201).json({ 
      entry,
      lunchOvertimeMinutes // Include overtime info for frontend
    });
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/time/clock-out - Clock out
router.post('/clock-out', async (req, res) => {
  try {
    const userId = req.user.id;
    const { break_minutes, notes } = req.body;

    const activeEntry = await db.getAsync(
      'SELECT * FROM time_entries WHERE user_id = ? AND clock_out IS NULL',
      [userId]
    );

    if (!activeEntry) {
      return res.status(400).json({ error: 'Not clocked in' });
    }

    const clockOutTime = new Date().toISOString();
    // Lunch breaks don't subtract time - only regular breaks do
    const isLunchBreak = notes && notes.toLowerCase().includes('lunch break');
    const breakMinutesForCalc = isLunchBreak ? 0 : (break_minutes || 0);
    const hours = calculateHours(activeEntry.clock_in, clockOutTime, breakMinutesForCalc);

    await db.runAsync(
      'UPDATE time_entries SET clock_out = ?, break_minutes = ?, notes = ? WHERE id = ?',
      [clockOutTime, break_minutes || 0, notes || null, activeEntry.id]
    );

    const entry = await db.getAsync('SELECT * FROM time_entries WHERE id = ?', [activeEntry.id]);
    
    // Check if this is end of day (not a lunch break) and if reminder is enabled
    let showCleanupReminder = false;
    if (!isLunchBreak) {
      try {
        const reminderSettings = await db.getAsync(
          'SELECT * FROM cleanup_reminder_settings ORDER BY id DESC LIMIT 1'
        );
        
        if (reminderSettings && reminderSettings.enabled === 1) {
          // Check if this is the final clock-out of the day (no more clock-ins after this)
          // Get Central Time date for today
          const now = new Date();
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Chicago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          const parts = formatter.formatToParts(now);
          const year = parts.find(p => p.type === 'year').value;
          const month = parts.find(p => p.type === 'month').value;
          const day = parts.find(p => p.type === 'day').value;
          const todayCentral = `${year}-${month}-${day}`;
          
          // Check if there are any future clock-ins for today (shouldn't be, but check anyway)
          const [todayYear, todayMonth, todayDay] = todayCentral.split('-').map(Number);
          const todayStartUTC = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay, 4, 0, 0));
          const todayEndUTC = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay + 1, 7, 0, 0));
          
          // Check if there are any active entries (user is still clocked in elsewhere)
          const activeEntries = await db.getAsync(
            'SELECT COUNT(*) as count FROM time_entries WHERE user_id = ? AND clock_out IS NULL',
            [userId]
          );
          
          // Check if this clock-out is after 12 PM Central Time (noon - more lenient)
          const clockOutDate = new Date(clockOutTime);
          const clockOutCentral = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Chicago',
            hour: '2-digit',
            hour12: false
          }).formatToParts(clockOutDate);
          const hour = parseInt(clockOutCentral.find(p => p.type === 'hour').value);
          
          // Show reminder if:
          // 1. It's after 12 PM (noon) Central Time (more lenient than 2 PM)
          // 2. There are no active entries (user is fully clocked out)
          // This ensures it shows for end-of-day clock-outs, not lunch breaks
          showCleanupReminder = hour >= 12 && activeEntries.count === 0;
          
          // Log for debugging
          if (showCleanupReminder) {
            console.log(`[Cleanup Reminder] Showing reminder for user ${userId} - Clock out time: ${hour}:00 Central, Active entries: ${activeEntries.count}`);
          } else {
            console.log(`[Cleanup Reminder] NOT showing for user ${userId} - Hour: ${hour}, Active entries: ${activeEntries.count}, Is lunch: ${isLunchBreak}, Enabled: ${reminderSettings.enabled === 1}`);
          }
        } else {
          console.log(`[Cleanup Reminder] Settings disabled or not found for user ${userId}`);
        }
      } catch (reminderError) {
        console.error('Error checking cleanup reminder settings:', reminderError);
        // Don't fail the clock-out if reminder check fails
      }
    }
    
    res.json({ 
      entry, 
      hours,
      showCleanupReminder 
    });
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/time/current - Get current clock status
router.get('/current', async (req, res) => {
  try {
    const userId = req.user.id;
    const activeEntry = await db.getAsync(
      'SELECT * FROM time_entries WHERE user_id = ? AND clock_out IS NULL',
      [userId]
    );

    if (!activeEntry) {
      return res.json({ clockedIn: false });
    }

    // Get Central Time date for today (Houston timezone) using proper timezone conversion
    const now = new Date();
    
    // Use Intl.DateTimeFormat to get Central Time date
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const todayCentral = `${year}-${month}-${day}`;
    
    // Get all time entries for today (in Central Time) to calculate total elapsed time
    // Use a wider UTC range to ensure we capture all entries, then filter by Central Time date
    // Central Time spans from UTC 05:00 (CDT) to UTC 06:00 (CST) the next day
    // Use a safe range: start from UTC 04:00 on the date, end at UTC 07:00 next day
    const [todayYear, todayMonth, todayDay] = todayCentral.split('-').map(Number);
    const todayStartUTC = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay, 4, 0, 0));
    const todayEndUTC = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay + 1, 7, 0, 0));
    
    const todayEntries = await db.allAsync(`
      SELECT * FROM time_entries 
      WHERE user_id = ? 
      AND clock_in >= ?
      AND clock_in < ?
      ORDER BY clock_in ASC
    `, [userId, todayStartUTC.toISOString(), todayEndUTC.toISOString()]);

    // Find the FIRST clock-in of the day (original morning clock-in)
    const firstClockIn = todayEntries.length > 0 ? todayEntries[0] : activeEntry;
    const originalClockIn = firstClockIn?.clock_in || activeEntry.clock_in;

    // Calculate total elapsed time for the day
    let totalElapsedMs = 0;
    
    if (!activeEntry.clock_in) {
      return res.status(500).json({ error: 'Invalid active entry: missing clock_in' });
    }
    
    let currentSessionStart = new Date(activeEntry.clock_in);
    
    // Validate date parsing
    if (isNaN(currentSessionStart.getTime())) {
      return res.status(500).json({ error: 'Invalid clock_in date format' });
    }
    
    // Calculate total elapsed time for TODAY using the EXACT same logic as grouped view
    // This must match exactly what's shown in the admin/employee time clock view for today
    
    // Use the grouped view logic: get entries for today, group by date, filter return entries
    // Extract Central Time date helper (same as grouped view)
    const extractCentralTimeDate = (clockInString) => {
      if (!clockInString) return null;
      try {
        const utcDate = new Date(clockInString);
        if (isNaN(utcDate.getTime())) return clockInString.split('T')[0];
        
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Chicago',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        
        const parts = formatter.formatToParts(utcDate);
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        
        return `${year}-${month}-${day}`;
      } catch (error) {
        return clockInString.split('T')[0];
      }
    };
    
    // Filter entries to only TODAY in Central Time
    const todayEntriesFiltered = todayEntries.filter(entry => {
      const entryDate = extractCentralTimeDate(entry.clock_in);
      return entryDate === todayCentral;
    });
    
    // Now use the EXACT grouped view logic for today's entries
    const lunchBreakEntries = todayEntriesFiltered.filter(e => 
      e.notes && e.notes.toLowerCase().includes('lunch break') && e.clock_out
    );
    const returnEntryIds = new Set();
    
    // Find return entries (same logic as grouped view)
    lunchBreakEntries.forEach(lunchEntry => {
      const lunchOutTime = new Date(lunchEntry.clock_out);
      let nextEntry = null;
      let minTimeDiff = Infinity;
      
      todayEntriesFiltered.forEach(entry => {
        if (entry.notes && entry.notes.toLowerCase().includes('lunch break')) return;
        if (!entry.clock_in || entry.id === lunchEntry.id) return;
        const entryInTime = new Date(entry.clock_in);
        if (entryInTime > lunchOutTime) {
          const hoursDiff = (entryInTime - lunchOutTime) / (1000 * 60 * 60);
          if (hoursDiff > 0 && hoursDiff <= 3) {
            const timeDiff = entryInTime - lunchOutTime;
            if (timeDiff < minTimeDiff) {
              minTimeDiff = timeDiff;
              nextEntry = entry;
            }
          }
        }
      });
      
      if (nextEntry) {
        returnEntryIds.add(nextEntry.id);
      }
    });
    
    // Calculate total hours worked for the day using EXACT same logic as grouped view
    // This ensures consistency between /current and /entries/grouped endpoints
    totalElapsedMs = 0;
    
    // Separate entries into work entries and return entries (same as grouped view)
    // IMPORTANT: Filter out duplicates - if a lunch break entry exists, it represents all work
    // from its clock_in to clock_out, so any other entry that starts before the lunch break's
    // clock_out should be excluded (same logic as grouped view)
    const workEntries = todayEntriesFiltered.filter(entry => {
      if (returnEntryIds.has(entry.id)) return false; // Exclude return entries
      
      // Check if this entry is a duplicate of a lunch break entry
      // A lunch break entry represents work from its clock_in to clock_out
      // So any entry that starts before a lunch break's clock_out is a duplicate
      const entryInTime = new Date(entry.clock_in);
      for (const lunchEntry of lunchBreakEntries) {
        if (!lunchEntry.clock_out || entry.id === lunchEntry.id) continue;
        const lunchOutTime = new Date(lunchEntry.clock_out);
        // If this entry starts before the lunch break's clock_out, it's a duplicate
        if (entryInTime < lunchOutTime) {
          return false; // Exclude duplicate
        }
      }
      return true; // Include this entry
    });
    const returnEntries = todayEntriesFiltered.filter(entry => returnEntryIds.has(entry.id));
    
    // Calculate hours from work entries (pre-lunch work)
    workEntries.forEach(entry => {
      if (!entry.clock_in) return;
      
      // Lunch breaks don't subtract time - only regular breaks do
      const breakMinutes = (entry.notes && entry.notes.toLowerCase().includes('lunch break')) ? 0 : (entry.break_minutes || 0);
      
      if (entry.clock_out) {
        const hours = calculateHours(entry.clock_in, entry.clock_out, breakMinutes) || 0;
        totalElapsedMs += hours * 60 * 60 * 1000;
      } else if (entry.id === activeEntry.id) {
        // Active entry (no clock_out) - calculate hours up to now
        const hours = calculateHours(entry.clock_in, now.toISOString(), breakMinutes) || 0;
        totalElapsedMs += hours * 60 * 60 * 1000;
      }
    });
    
    // Also include return entries (post-lunch work) in the total
    returnEntries.forEach(entry => {
      if (!entry.clock_in) return;
      
      if (entry.clock_out) {
        const hours = calculateHours(entry.clock_in, entry.clock_out, entry.break_minutes || 0) || 0;
        totalElapsedMs += hours * 60 * 60 * 1000;
      } else if (entry.id === activeEntry.id) {
        // Active return entry (no clock_out) - calculate hours up to now
        const hours = calculateHours(entry.clock_in, now.toISOString(), entry.break_minutes || 0) || 0;
        totalElapsedMs += hours * 60 * 60 * 1000;
      }
    });

    const totalElapsedHours = totalElapsedMs / (1000 * 60 * 60);
    const currentSessionHours = (now - currentSessionStart) / (1000 * 60 * 60);

    // Create entry object with original clock-in time for display
    // Keep the actual activeEntry.clock_in for the current session, but add originalClockIn for display
    const entryWithOriginalClockIn = {
      ...activeEntry,
      original_clock_in: originalClockIn // Include original clock-in time for display
    };

    res.json({
      clockedIn: true,
      entry: entryWithOriginalClockIn,
      elapsedHours: totalElapsedHours.toFixed(2),
      currentSessionHours: currentSessionHours.toFixed(2),
      totalElapsedMs: totalElapsedMs, // Include in milliseconds for more precise frontend calculation
      originalClockIn: originalClockIn // Also include separately for easy access
    });
  } catch (error) {
    console.error('Get current status error:', error);
    return res.json({ clockedIn: false });
  }
});

// GET /api/time/employees/status - Get all employees' and admins' current status (admin only)
router.get('/employees/status', requireAdmin, async (req, res) => {
  try {
    // Get today's date in Central Time
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    
    // Get all active users (employees and admins) with last_login
    const users = await db.allAsync(
      'SELECT id, full_name, username, role, last_login FROM users WHERE is_active = 1 AND role IN (?, ?) ORDER BY role, full_name',
      ['employee', 'admin']
    );
    
    // Get today's cleanup acknowledgments
    let cleanupAcks = [];
    try {
      cleanupAcks = await db.allAsync(
        'SELECT user_id, acknowledged_at FROM cleanup_acknowledgments WHERE acknowledgment_date = ?',
        [today]
      ) || [];
    } catch (e) {
      // Table might not exist yet
    }
    const ackMap = new Map(cleanupAcks.map(a => [a.user_id, a.acknowledged_at]));

    // Get status for each user
    const employeeStatuses = await Promise.all(
      users.map(async (employee) => {
        // Check if they're currently clocked in
        const activeEntry = await db.getAsync(
          'SELECT * FROM time_entries WHERE user_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
          [employee.id]
        );

        let status = 'off';
        let statusDetails = {
          clockedIn: false,
          onLunch: false,
          clockInTime: null,
          elapsedHours: '0:00',
          lastActivity: null
        };

        if (activeEntry) {
          // They're clocked in
          const clockInTime = new Date(activeEntry.clock_in);
          const now = new Date();
          const elapsedMs = now - clockInTime;
          const elapsedHours = elapsedMs / (1000 * 60 * 60);

          status = 'clocked_in';
          statusDetails = {
            clockedIn: true,
            onLunch: false,
            clockInTime: activeEntry.clock_in,
            elapsedHours: elapsedHours.toFixed(2),
            lastActivity: activeEntry.clock_in
          };
        } else {
          // Check if they're on lunch break (clocked out with lunch break note today)
          const lunchEntry = await db.getAsync(
            `SELECT te.* FROM time_entries te
             WHERE te.user_id = ? 
             AND DATE(te.clock_in) = ?
             AND te.notes LIKE '%Lunch break%'
             AND te.clock_out IS NOT NULL
             ORDER BY te.clock_out DESC LIMIT 1`,
            [employee.id, today]
          );

          if (lunchEntry) {
            // Check if there's a return entry after this lunch break
            const returnEntry = await db.getAsync(
              `SELECT * FROM time_entries 
               WHERE user_id = ? 
               AND DATE(clock_in) = ?
               AND clock_in > ?
               AND (notes IS NULL OR notes NOT LIKE '%Lunch break%')
               ORDER BY clock_in ASC LIMIT 1`,
              [employee.id, today, lunchEntry.clock_out]
            );

            if (!returnEntry) {
              // They're on lunch break
              status = 'on_lunch';
              statusDetails = {
                clockedIn: false,
                onLunch: true,
                clockInTime: null,
                elapsedHours: '0:00',
                lastActivity: lunchEntry.clock_out,
                lunchOutTime: lunchEntry.clock_out
              };
            } else {
              // They clocked back in from lunch
              status = 'off';
              statusDetails = {
                clockedIn: false,
                onLunch: false,
                clockInTime: null,
                elapsedHours: '0:00',
                lastActivity: returnEntry.clock_out || returnEntry.clock_in
              };
            }
          } else {
            // Check if they worked today
            const todayEntry = await db.getAsync(
              `SELECT * FROM time_entries 
               WHERE user_id = ? 
               AND DATE(clock_in) = ?
               ORDER BY clock_in DESC LIMIT 1`,
              [employee.id, today]
            );

            if (todayEntry) {
              status = 'off';
              statusDetails = {
                clockedIn: false,
                onLunch: false,
                clockInTime: null,
                elapsedHours: '0:00',
                lastActivity: todayEntry.clock_out || todayEntry.clock_in
              };
            } else {
              // No activity today
              status = 'off';
              statusDetails = {
                clockedIn: false,
                onLunch: false,
                clockInTime: null,
                elapsedHours: '0:00',
                lastActivity: null
              };
            }
          }
        }

        // Get last login time
        const lastLogin = employee.last_login ? new Date(employee.last_login) : null;
        
        // Calculate days since last login
        let daysSinceLogin = null;
        if (lastLogin) {
          const now = new Date();
          const diffMs = now - lastLogin;
          daysSinceLogin = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
        
        // Calculate total hours worked today
        let hoursWorkedToday = 0;
        try {
          const todayEntries = await db.allAsync(
            `SELECT clock_in, clock_out, break_minutes FROM time_entries 
             WHERE user_id = ? AND DATE(clock_in) = ?`,
            [employee.id, today]
          );
          
          for (const entry of todayEntries) {
            if (entry.clock_out) {
              // Completed entry
              const clockIn = new Date(entry.clock_in);
              const clockOut = new Date(entry.clock_out);
              const breakMins = entry.break_minutes || 0;
              const hoursMs = clockOut - clockIn - (breakMins * 60 * 1000);
              hoursWorkedToday += hoursMs / (1000 * 60 * 60);
            } else {
              // Active entry - calculate up to now
              const clockIn = new Date(entry.clock_in);
              const now = new Date();
              const hoursMs = now - clockIn;
              hoursWorkedToday += hoursMs / (1000 * 60 * 60);
            }
          }
        } catch (e) {
          console.error('Error calculating hours:', e);
        }
        
        // Check cleanup acknowledgment
        const cleanupAcknowledged = ackMap.has(employee.id);
        const cleanupAcknowledgedAt = ackMap.get(employee.id) || null;
        
        return {
          ...employee,
          status,
          ...statusDetails,
          lastLogin: employee.last_login,
          daysSinceLogin,
          hoursWorkedToday: hoursWorkedToday > 0 ? hoursWorkedToday.toFixed(2) : null,
          cleanupAcknowledged,
          cleanupAcknowledgedAt
        };
      })
    );

    res.json({ employees: employeeStatuses });
  } catch (error) {
    console.error('Get employees status error:', error);
    return res.json({ employees: [] });
  }
});

// GET /api/time/entries/grouped - Get time entries grouped by day with lunch breaks
// This must be defined BEFORE /entries to avoid route conflicts
// Employees can view their own entries, admins can view any user's entries
router.get('/entries/grouped', async (req, res) => {
  try {
    const { user_id, start_date, end_date } = req.query;
    
    // Employees can only view their own entries, admins can view any user's entries
    const targetUserId = req.user.role === 'admin' 
      ? (user_id || req.user.id) 
      : req.user.id;
    
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    let query = `
      SELECT te.*, u.full_name as user_name, u.username, u.hourly_rate, u.weekly_salary
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.user_id = ?
    `;
    const params = [targetUserId];

    // Filter by date range - use wider UTC range to account for timezone conversion
    // We'll filter by Central Time date during grouping, so use a safe UTC range here
    if (start_date) {
      // Start date: Central Time 00:00:00 could be UTC 05:00:00 (CDT) or 06:00:00 (CST)
      // Use a safe range: start from UTC 04:00:00 (covers both CDT and CST)
      const [year, month, day] = start_date.split('-').map(Number);
      const startDateUTC = new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
      query += ' AND clock_in >= ?';
      params.push(startDateUTC.toISOString());
    }
    if (end_date) {
      // End date: Central Time 23:59:59 could be UTC 04:59:59 (CDT) or 05:59:59 (CST) next day
      // Use a safe range: end at UTC 06:00:00 next day (covers both)
      const [year, month, day] = end_date.split('-').map(Number);
      const endDateUTC = new Date(Date.UTC(year, month - 1, day + 1, 6, 0, 0));
      query += ' AND clock_in < ?';
      params.push(endDateUTC.toISOString());
    }

    query += ' ORDER BY te.clock_in ASC';

    const entries = await db.allAsync(query, params);
    

    // Group entries by day and pair lunch breaks
    const groupedByDay = {};
    const lunchBreakEntryIds = new Set();
    const lunchBreakByUser = {}; // Track lunch breaks by user_id for faster lookup
    
    // First pass: Identify lunch break entries
    entries.forEach(entry => {
      if (entry.notes && entry.notes.toLowerCase().includes('lunch break')) {
        lunchBreakEntryIds.add(entry.id);
        if (!lunchBreakByUser[entry.user_id]) {
          lunchBreakByUser[entry.user_id] = [];
        }
        lunchBreakByUser[entry.user_id].push(entry);
      }
    });
    
    // Helper function to extract date in Central Time (Houston) from clock_in string
    // Uses proper timezone conversion via Intl API (handles DST automatically)
    const extractCentralTimeDate = (clockInString) => {
      if (!clockInString) return null;
      try {
        const utcDate = new Date(clockInString);
        if (isNaN(utcDate.getTime())) {
          return clockInString.split('T')[0];
        }
        
        // Use Intl.DateTimeFormat to get Central Time date components
        // This automatically handles DST (CST vs CDT)
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Chicago',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        
        const parts = formatter.formatToParts(utcDate);
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        
        return `${year}-${month}-${day}`;
      } catch (error) {
        console.warn('Error extracting Central Time date:', clockInString, error);
        return clockInString.split('T')[0];
      }
    };
    
    entries.forEach(entry => {
      const date = extractCentralTimeDate(entry.clock_in); // Get date part in Central Time
      
      if (!groupedByDay[date]) {
        groupedByDay[date] = {
          date,
          workEntries: [],
          lunchBreaks: [],
          totalHours: 0,
          totalCost: 0
        };
      }
      
      // Check if this is a lunch break
      if (entry.notes && entry.notes.toLowerCase().includes('lunch break')) {
        // Add to lunch breaks
        groupedByDay[date].lunchBreaks.push({
          id: entry.id,
          clockOut: entry.clock_out,
          clockIn: null, // Will be filled by next entry
          duration: entry.break_minutes || 0
        });
        
        // Add as work entry for time BEFORE lunch (clock_in to clock_out)
        // Lunch breaks don't subtract time - only regular breaks do
        if (entry.clock_in && entry.clock_out) {
          const hours = calculateHours(entry.clock_in, entry.clock_out, 0);
          groupedByDay[date].workEntries.push({
            ...entry,
            hours: hours.toFixed(2),
            isPreLunchWork: true
          });
        }
      } else {
        // Regular work entry - only add if it's NOT a duplicate of a lunch break entry FROM THE SAME DATE
        // A lunch break entry represents work from its clock_in to clock_out
        // So skip any entry that starts before a lunch break entry's clock_out (for the same user on the same date)
        let isDuplicate = false;
        
        // Check lunch breaks for this user ON THE SAME DATE only
        const userLunchBreaks = lunchBreakByUser[entry.user_id] || [];
        for (const lunchEntry of userLunchBreaks) {
          if (!lunchEntry.clock_out) continue;
          
          // CRITICAL: Only compare to lunch breaks from the same date
          const lunchDate = extractCentralTimeDate(lunchEntry.clock_in);
          if (lunchDate !== date) continue;
          
          const entryInTime = new Date(entry.clock_in);
          const lunchOutTime = new Date(lunchEntry.clock_out);
          
          // If this entry starts before the lunch break's clock_out, it's a duplicate
          // The lunch break entry already represents all work from its clock_in to clock_out
          if (entryInTime < lunchOutTime) {
            isDuplicate = true;
            break;
          }
        }
        
        if (!isDuplicate) {
          const hours = entry.clock_out 
            ? calculateHours(entry.clock_in, entry.clock_out, entry.break_minutes)
            : 0;
          
          groupedByDay[date].workEntries.push({
            ...entry,
            hours: hours.toFixed(2)
          });
        }
      }
    });

    // Match lunch breaks with clock-ins
    // Process entries chronologically to match lunch breaks correctly
    // Track which entries are used as return entries so we can exclude them from workEntries
    // Use a Map to track return entry IDs per date (not a shared Set across all dates)
    const returnEntryIdsByDate = {};
    
    // First pass: Match all lunch breaks with return entries
    Object.keys(groupedByDay).forEach(date => {
      const day = groupedByDay[date];
      returnEntryIdsByDate[date] = new Set(); // Create a new Set for each date
      
      // Sort work entries by clock-in time
      day.workEntries.sort((a, b) => new Date(a.clock_in) - new Date(b.clock_in));
      
      // Sort lunch breaks by clock-out time
      day.lunchBreaks.sort((a, b) => new Date(a.clockOut) - new Date(b.clockOut));
      
      day.lunchBreaks.forEach((lunch) => {
        // Find the next clock-in after this lunch break clock-out
        const lunchOutTime = new Date(lunch.clockOut);
        
        // Search ALL entries (not just this day's workEntries) to find the return entry
        // This handles cases where the return entry might be on a different day
        let nextEntry = null;
        let minTimeDiff = Infinity;
        
        // First, try to find return entry on the same day
        day.workEntries.forEach(entry => {
          const entryInTime = new Date(entry.clock_in);
          if (entryInTime > lunchOutTime) {
            const timeDiff = entryInTime - lunchOutTime;
            if (timeDiff < minTimeDiff) {
              minTimeDiff = timeDiff;
              nextEntry = entry;
            }
          }
        });
        
        // If not found on same day, check ALL entries in the date range (not just grouped by day)
        // But only accept entries within 3 hours (reasonable lunch duration)
        if (!nextEntry) {
          // Search through ALL entries (not just grouped by day) to find the return entry
          entries.forEach(entry => {
            // Skip lunch break entries
            if (entry.notes && entry.notes.toLowerCase().includes('lunch break')) {
              return;
            }
            // Skip if no clock_in
            if (!entry.clock_in) {
              return;
            }
            
            const entryInTime = new Date(entry.clock_in);
            if (entryInTime > lunchOutTime) {
              const hoursDiff = (entryInTime - lunchOutTime) / (1000 * 60 * 60);
              // Only accept if within 3 hours (reasonable lunch duration)
              if (hoursDiff > 0 && hoursDiff <= 3) {
                const timeDiff = entryInTime - lunchOutTime;
                if (timeDiff < minTimeDiff) {
                  minTimeDiff = timeDiff;
                  nextEntry = entry;
                }
              }
            }
          });
        }
        
        if (nextEntry) {
          lunch.clockIn = nextEntry.clock_in;
          lunch.returnEntryId = nextEntry.id; // Store the return entry ID for editing
          const lunchDuration = Math.floor((new Date(nextEntry.clock_in) - lunchOutTime) / (1000 * 60));
          lunch.duration = lunchDuration;
          returnEntryIdsByDate[date].add(nextEntry.id); // Mark this entry as a return entry for THIS date only
        }
      });
    });
    
    // Second pass: Remove return entries from workEntries display, but include them in totalHours calculation
    // Filter out ALL return entries from workEntries (they're shown as part of lunch break details, not as separate work entries)
    Object.keys(groupedByDay).forEach(date => {
      const day = groupedByDay[date];
      
      // Get return entry IDs for this specific date
      const returnEntryIdsForDate = returnEntryIdsByDate[date] || new Set();
      
      // Store return entries separately for total calculation
      const returnEntries = day.workEntries.filter(entry => returnEntryIdsForDate.has(entry.id));
      
      // For pre-lunch work entries, update clock_out to show the actual end-of-day clock_out (from return entry)
      // Store original clock_out for hours calculation
      day.workEntries.forEach(entry => {
        if (entry.isPreLunchWork && returnEntries.length > 0) {
          // Store the original clock_out (lunch break time) for hours calculation
          entry.original_clock_out = entry.clock_out;
          
          // Find the return entry that matches this pre-lunch entry's lunch break
          const matchingLunchBreak = day.lunchBreaks.find(lunch => {
            if (!lunch.clockOut || !entry.clock_out) return false;
            const lunchOut = new Date(lunch.clockOut);
            const entryOut = new Date(entry.clock_out);
            return Math.abs(lunchOut - entryOut) < 60000;
          });
          
          if (matchingLunchBreak && matchingLunchBreak.returnEntryId) {
            const returnEntry = returnEntries.find(re => re.id === matchingLunchBreak.returnEntryId);
            if (returnEntry && returnEntry.clock_out) {
              // Update the pre-lunch entry's clock_out to show the actual end-of-day clock_out
              entry.clock_out = returnEntry.clock_out;
            }
          } else if (returnEntries.length === 1) {
            // If there's only one return entry, use it
            const returnEntry = returnEntries[0];
            if (returnEntry && returnEntry.clock_out) {
              entry.clock_out = returnEntry.clock_out;
            }
          }
        }
      });
      
      // Filter return entries out of workEntries for display purposes
      day.workEntries = day.workEntries.filter(entry => {
        // Filter out ALL return entries (both active and completed)
        // Return entries are shown as part of lunch break details, not as separate work entries
        return !returnEntryIdsForDate.has(entry.id);
      });
      
      // RECALCULATE totalHours including BOTH work entries AND return entries
      // This ensures post-lunch work is counted in the total
      day.totalHours = 0;
      const now = new Date();
      
      // Calculate hours from work entries (pre-lunch work)
      day.workEntries.forEach(entry => {
        // Lunch breaks don't subtract time - only regular breaks do
        const breakMinutes = (entry.notes && entry.notes.toLowerCase().includes('lunch break')) ? 0 : (entry.break_minutes || 0);
        
        if (entry.isPreLunchWork) {
          // For pre-lunch entries, calculate hours only for the pre-lunch period
          // Use the original clock_out (lunch break time) for hours calculation
          const clockOutForHours = entry.original_clock_out || entry.clock_out;
          const hours = calculateHours(entry.clock_in, clockOutForHours, breakMinutes);
          day.totalHours += hours;
          entry.hours = hours.toFixed(2);
        } else if (entry.clock_out) {
          const hours = calculateHours(entry.clock_in, entry.clock_out, breakMinutes);
          day.totalHours += hours;
          // Update the entry's hours in case it changed
          entry.hours = hours.toFixed(2);
        } else {
          // Active entry (no clock_out) - calculate hours up to now
          const hours = calculateHours(entry.clock_in, now.toISOString(), breakMinutes);
          day.totalHours += hours;
          entry.hours = hours.toFixed(2);
          entry.isActive = true; // Mark as active for frontend display
        }
      });
      
      // Also include return entries (post-lunch work) in the total
      returnEntries.forEach(entry => {
        if (entry.clock_out) {
          const hours = calculateHours(entry.clock_in, entry.clock_out, entry.break_minutes || 0);
          day.totalHours += hours;
        } else {
          // Active return entry (no clock_out) - calculate hours up to now
          const hours = calculateHours(entry.clock_in, now.toISOString(), entry.break_minutes || 0);
          day.totalHours += hours;
        }
      });
      
      // Calculate hourly rate from weekly salary if provided
      const firstEntry = entries.find(e => {
        const entryDate = extractCentralTimeDate(e.clock_in);
        return entryDate === date;
      });
      if (firstEntry) {
        let effectiveHourlyRate = firstEntry.hourly_rate || 0;
        if (firstEntry.weekly_salary && firstEntry.weekly_salary > 0) {
          effectiveHourlyRate = firstEntry.weekly_salary / 40; // Weekly salary / 40 hours
        }
        day.effectiveHourlyRate = effectiveHourlyRate.toFixed(2);
        day.totalCost = (day.totalHours * effectiveHourlyRate).toFixed(2);
      }
    });

    // Convert to array and sort by date
    const result = Object.values(groupedByDay).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    res.json({ days: result });
  } catch (error) {
    console.error('Get grouped time entries error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/time/entries - Get time entries
router.get('/entries', async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? req.query.user_id || req.user.id : req.user.id;
    const { start_date, end_date } = req.query;

    let query = `
      SELECT te.*, u.full_name as user_name, u.username
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.user_id = ?
    `;
    const params = [userId];

    // Use UTC date comparison to avoid timezone issues
    if (start_date) {
      query += ` AND (
        (te.clock_in LIKE ? || '%') OR 
        (te.clock_in >= ? || 'T00:00:00.000Z')
      )`;
      params.push(start_date, start_date);
    }
    if (end_date) {
      query += ` AND (
        (te.clock_in LIKE ? || '%') OR 
        (te.clock_in <= ? || 'T23:59:59.999Z')
      )`;
      params.push(end_date, end_date);
    }

    query += ' ORDER BY te.clock_in DESC';

    const entries = await db.allAsync(query, params);

    // Calculate hours for each entry
    const entriesWithHours = entries.map(entry => {
      const hours = entry.clock_out 
        ? calculateHours(entry.clock_in, entry.clock_out, entry.break_minutes)
        : null;
      return { ...entry, hours };
    });

    res.json({ entries: entriesWithHours });
  } catch (error) {
    console.error('Get time entries error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/time/entries/:id - Get a single time entry
router.get('/entries/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const entry = await db.getAsync(`
      SELECT te.*, u.full_name as user_name, u.username
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.id = ?
    `, [id]);
    
    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }
    
    const hours = entry.clock_out 
      ? calculateHours(entry.clock_in, entry.clock_out, entry.break_minutes)
      : null;
    
    res.json({ entry: { ...entry, hours } });
  } catch (error) {
    console.error('Get time entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/time/entries - Create time entry (admin only, for creating return entries)
router.post('/entries', requireAdmin, async (req, res) => {
  try {
    const { user_id, clock_in, clock_out, break_minutes, notes } = req.body;
    
    if (!user_id || !clock_in) {
      return res.status(400).json({ error: 'user_id and clock_in are required' });
    }
    
    const weekEnding = getWeekEndingDate();
    
    const result = await db.runAsync(
      'INSERT INTO time_entries (user_id, clock_in, clock_out, break_minutes, notes, week_ending_date) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, clock_in, clock_out || null, break_minutes || 0, notes || null, weekEnding]
    );
    
    const entry = await db.getAsync('SELECT * FROM time_entries WHERE id = ?', [result.lastID]);
    const hours = entry.clock_out 
      ? calculateHours(entry.clock_in, entry.clock_out, entry.break_minutes)
      : null;
    
    res.status(201).json({ entry: { ...entry, hours } });
  } catch (error) {
    console.error('Create time entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/time/entries/:id - Edit time entry (admin only)
router.put('/entries/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { clock_in, clock_out, break_minutes, notes } = req.body;

    const currentEntry = await db.getAsync('SELECT * FROM time_entries WHERE id = ?', [id]);
    if (!currentEntry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    await db.runAsync(
      `UPDATE time_entries 
       SET clock_in = ?, clock_out = ?, break_minutes = ?, notes = ?
       WHERE id = ?`,
      [
        clock_in || currentEntry.clock_in,
        clock_out !== undefined ? clock_out : currentEntry.clock_out,
        break_minutes !== undefined ? break_minutes : currentEntry.break_minutes,
        notes !== undefined ? notes : currentEntry.notes,
        id
      ]
    );

    const updatedEntry = await db.getAsync(`
      SELECT te.*, u.full_name as user_name, u.username
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.id = ?
    `, [id]);
    
    if (!updatedEntry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }
    
    const hours = updatedEntry.clock_out 
      ? calculateHours(updatedEntry.clock_in, updatedEntry.clock_out, updatedEntry.break_minutes)
      : null;

    res.json({ entry: updatedEntry, hours });
  } catch (error) {
    console.error('Update time entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/time/entries/:id/approve - Approve time entry
router.post('/entries/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync(
      'UPDATE time_entries SET approved_by = ? WHERE id = ?',
      [req.user.id, id]
    );
    res.json({ message: 'Time entry approved' });
  } catch (error) {
    console.error('Approve time entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/time/report - Generate timesheet report
router.get('/report', requireAdmin, async (req, res) => {
  try {
    const { week_ending_date, user_id } = req.query;
    const weekEnding = week_ending_date || getWeekEndingDate();

    let query = `
      SELECT te.*, u.full_name as user_name, u.username, u.hourly_rate, u.weekly_salary
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.week_ending_date = ?
    `;
    const params = [weekEnding];

    if (user_id) {
      query += ' AND te.user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY u.full_name, te.clock_in';

    const entries = await db.allAsync(query, params);

    // Calculate totals
    const report = entries.map(entry => {
      const hours = entry.clock_out 
        ? calculateHours(entry.clock_in, entry.clock_out, entry.break_minutes)
        : 0;
      
      // Calculate hourly rate from weekly salary if provided (assuming 40 hours/week)
      let effectiveHourlyRate = entry.hourly_rate || 0;
      if (entry.weekly_salary && entry.weekly_salary > 0) {
        effectiveHourlyRate = entry.weekly_salary / 40; // Weekly salary / 40 hours
      }
      
      const pay = hours * effectiveHourlyRate;
      return {
        ...entry,
        hours: hours.toFixed(2),
        pay: pay.toFixed(2),
        effective_hourly_rate: effectiveHourlyRate.toFixed(2)
      };
    });

    res.json({ report, week_ending_date: weekEnding });
  } catch (error) {
    console.error('Generate report error:', error);
    return res.json({ report: [], week_ending_date: getWeekEndingDate() });
  }
});

// GET /api/time/cleanup-reminder - Get cleanup reminder message (all authenticated users can read)
router.get('/cleanup-reminder', async (req, res) => {
  try {
    const settings = await db.getAsync(
      'SELECT * FROM cleanup_reminder_settings ORDER BY id DESC LIMIT 1'
    );
    
    if (!settings || settings.enabled !== 1) {
      // Return default if disabled or none exists
      return res.json({
        message: 'Great work today! Before you head out, let\'s finish strong by ensuring our entire shop is clean and ready for tomorrow. A clean shop is a professional shop, and it shows pride in our work. Thank you for being part of a team that takes pride in our workspace!',
        enabled: settings ? settings.enabled === 1 : true
      });
    }
    
    // Get all enabled messages from the messages pool
    const messages = await db.allAsync(
      'SELECT * FROM cleanup_reminder_messages WHERE enabled = 1 ORDER BY id'
    );
    
    let selectedMessage;
    
    if (messages && messages.length > 0) {
      // Use date as seed so everyone sees the same message on the same day
      // This rotates daily but is consistent for all employees
      const today = new Date();
      const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD
      // Simple hash of date string to get consistent index
      let hash = 0;
      for (let i = 0; i < dateString.length; i++) {
        hash = ((hash << 5) - hash) + dateString.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
      }
      // Use absolute value and modulo to get index
      const messageIndex = Math.abs(hash) % messages.length;
      selectedMessage = messages[messageIndex].message;
    } else {
      // Fallback to settings message if no pool messages exist
      selectedMessage = settings.message;
    }
    
    // Return randomly selected message and enabled status
    res.json({
      message: selectedMessage,
      enabled: true
    });
  } catch (error) {
    console.error('Get cleanup reminder error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/time/cleanup-messages - Get all cleanup reminder messages (admin only)
router.get('/cleanup-messages', requireAdmin, async (req, res) => {
  try {
    // Check if table exists first
    const tableCheck = await db.getAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='cleanup_reminder_messages'"
    );
    
    if (!tableCheck) {
      // Table doesn't exist, return empty array
      return res.json({ messages: [] });
    }
    
    const messages = await db.allAsync(
      'SELECT * FROM cleanup_reminder_messages ORDER BY created_at DESC'
    );
    res.json({ messages: messages || [] });
  } catch (error) {
    console.error('Get cleanup messages error:', error);
    // Return empty array instead of error to allow UI to work
    res.json({ messages: [] });
  }
});

// POST /api/time/cleanup-messages - Add a new cleanup reminder message (admin only)
router.post('/cleanup-messages', requireAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const result = await db.runAsync(
      'INSERT INTO cleanup_reminder_messages (message, enabled) VALUES (?, ?)',
      [message.trim(), 1]
    );
    
    const newMessage = await db.getAsync(
      'SELECT * FROM cleanup_reminder_messages WHERE id = ?',
      [result.lastID]
    );
    
    res.status(201).json({ message: newMessage });
  } catch (error) {
    console.error('Add cleanup message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/time/cleanup-messages/:id - Update a cleanup reminder message (admin only)
router.put('/cleanup-messages/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { message, enabled } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    await db.runAsync(
      'UPDATE cleanup_reminder_messages SET message = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [message.trim(), enabled ? 1 : 0, id]
    );
    
    const updated = await db.getAsync(
      'SELECT * FROM cleanup_reminder_messages WHERE id = ?',
      [id]
    );
    
    res.json({ message: updated });
  } catch (error) {
    console.error('Update cleanup message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/time/cleanup-messages/:id - Delete a cleanup reminder message (admin only)
router.delete('/cleanup-messages/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM cleanup_reminder_messages WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete cleanup message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/time/cleanup-reminder - Update cleanup reminder settings (admin only)
router.put('/cleanup-reminder', requireAdmin, async (req, res) => {
  try {
    const { message, enabled } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Check if settings exist
    const existing = await db.getAsync(
      'SELECT * FROM cleanup_reminder_settings ORDER BY id DESC LIMIT 1'
    );
    
    if (existing) {
      // Update existing
      await db.runAsync(
        'UPDATE cleanup_reminder_settings SET message = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?',
        [message.trim(), enabled ? 1 : 0, req.user.id, existing.id]
      );
    } else {
      // Create new
      await db.runAsync(
        'INSERT INTO cleanup_reminder_settings (message, enabled, updated_by) VALUES (?, ?, ?)',
        [message.trim(), enabled ? 1 : 0, req.user.id]
      );
    }
    
    const updated = await db.getAsync(
      'SELECT * FROM cleanup_reminder_settings ORDER BY id DESC LIMIT 1'
    );
    
    res.json({
      message: updated.message,
      enabled: updated.enabled === 1
    });
  } catch (error) {
    console.error('Update cleanup reminder error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/time/cleanup-acknowledge - Record cleanup reminder acknowledgment
router.post('/cleanup-acknowledge', async (req, res) => {
  try {
    const userId = req.user.id;
    const { time_entry_id, message_shown } = req.body;
    
    // Get today's date in Central Time
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    
    // Insert or update acknowledgment for today
    await db.runAsync(`
      INSERT OR REPLACE INTO cleanup_acknowledgments 
      (user_id, time_entry_id, acknowledgment_date, acknowledged_at, message_shown)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `, [userId, time_entry_id || null, today, message_shown || null]);
    
    res.json({ success: true, date: today });
  } catch (error) {
    console.error('Record cleanup acknowledgment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/time/cleanup-acknowledgments - Get cleanup acknowledgments for today (admin only)
router.get('/cleanup-acknowledgments', requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    
    // Get today's date in Central Time if not specified
    const targetDate = date || new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    
    const acknowledgments = await db.allAsync(`
      SELECT ca.*, u.full_name, u.username
      FROM cleanup_acknowledgments ca
      JOIN users u ON ca.user_id = u.id
      WHERE ca.acknowledgment_date = ?
      ORDER BY ca.acknowledged_at DESC
    `, [targetDate]);
    
    res.json({ acknowledgments: acknowledgments || [], date: targetDate });
  } catch (error) {
    console.error('Get cleanup acknowledgments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

