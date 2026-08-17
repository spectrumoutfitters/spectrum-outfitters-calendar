import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  getDefaultAnalyticsWeekRange,
  getWeeklyComparisonWeekRange,
  coerceAnalyticsWeekCount,
  formatTasksPerHour,
  formatCompletionRate,
  formatTaskHoursRatio,
  formatSubtaskCompletionRate,
  weekComparisonLabel,
} from '../utils/analyticsPerformanceMath.js';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticateToken);
router.use(requireAdmin);

// Helper function to calculate task duration in hours
const calculateTaskDuration = (startedAt, completedAt) => {
  if (!startedAt || !completedAt) return null;
  const start = new Date(startedAt);
  const end = new Date(completedAt);
  const diffMs = end - start;
  return diffMs / (1000 * 60 * 60); // Convert to hours
};

// GET /api/analytics/employee-performance - Get employee performance metrics
router.get('/employee-performance', async (req, res) => {
  try {
    const { user_id, start_date, end_date } = req.query;
    
    // Default to current week if no dates provided
    let startDate = start_date;
    let endDate = end_date;
    
    if (!startDate || !endDate) {
      const range = getDefaultAnalyticsWeekRange();
      startDate = range.startDate;
      endDate = range.endDate;
    }

    let query = `
      SELECT 
        u.id,
        u.full_name,
        u.username,
        u.role,
        u.hourly_rate,
        u.weekly_salary,
        COUNT(DISTINCT t.id) as total_tasks_assigned,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as tasks_completed,
        COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as tasks_in_progress,
        COUNT(DISTINCT CASE WHEN t.status = 'todo' THEN t.id END) as tasks_todo,
        COUNT(DISTINCT CASE WHEN t.status = 'review' THEN t.id END) as tasks_in_review,
        SUM(CASE 
          WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL 
          THEN (julianday(t.completed_at) - julianday(t.started_at)) * 24 
            - COALESCE((
              SELECT SUM((julianday(tb.break_end) - julianday(tb.break_start)) * 24)
              FROM task_breaks tb
              WHERE tb.task_id = t.id
                AND tb.break_start >= t.started_at
                AND tb.break_end IS NOT NULL
                AND tb.break_end <= t.completed_at
            ), 0)
          WHEN t.status = 'completed' AND t.started_at IS NULL AND t.completed_at IS NULL
          THEN (julianday(t.updated_at) - julianday(t.created_at)) * 24
          ELSE 0 
        END) as total_task_hours,
        AVG(CASE 
          WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL 
          THEN (julianday(t.completed_at) - julianday(t.started_at)) * 24 
            - COALESCE((
              SELECT SUM((julianday(tb.break_end) - julianday(tb.break_start)) * 24)
              FROM task_breaks tb
              WHERE tb.task_id = t.id
                AND tb.break_start >= t.started_at
                AND tb.break_end IS NOT NULL
                AND tb.break_end <= t.completed_at
            ), 0)
          WHEN t.status = 'completed' AND t.started_at IS NULL AND t.completed_at IS NULL
          THEN (julianday(t.updated_at) - julianday(t.created_at)) * 24
          ELSE NULL 
        END) as avg_task_duration_hours,
        COUNT(DISTINCT CASE 
          WHEN (t.started_at IS NOT NULL AND t.completed_at IS NOT NULL)
             OR (t.status = 'completed' AND t.started_at IS NULL AND t.completed_at IS NULL)
          THEN t.id 
        END) as tasks_with_timing
      FROM users u
      LEFT JOIN tasks t ON t.assigned_to = u.id 
        AND (
          (t.status = 'completed' AND (
            (t.completed_at IS NOT NULL AND DATE(t.completed_at) >= ? AND DATE(t.completed_at) <= ?)
            OR
            (t.completed_at IS NULL AND DATE(t.updated_at) >= ? AND DATE(t.updated_at) <= ?)
          ))
          OR
          (t.status != 'completed' AND DATE(t.created_at) >= ? AND DATE(t.created_at) <= ?)
        )
      WHERE u.is_active = 1
    `;
    
    const params = [startDate, endDate, startDate, endDate, startDate, endDate];
    
    if (user_id) {
      query += ' AND u.id = ?';
      params.push(user_id);
    }
    
    query += ' GROUP BY u.id, u.full_name, u.username, u.role, u.hourly_rate, u.weekly_salary';
    query += ' ORDER BY tasks_completed DESC, u.full_name ASC';

    const employees = await db.allAsync(query, params);

    // Get time entries for each employee
    for (let emp of employees) {
      const timeEntries = await db.allAsync(`
        SELECT 
          SUM(CASE 
            WHEN clock_out IS NOT NULL 
            THEN (julianday(clock_out) - julianday(clock_in)) * 24 - (break_minutes / 60.0)
            ELSE 0 
          END) as total_hours_worked
        FROM time_entries
        WHERE user_id = ?
          AND DATE(clock_in) >= ?
          AND DATE(clock_in) <= ?
          AND clock_out IS NOT NULL
      `, [emp.id, startDate, endDate]);

      emp.total_hours_worked = timeEntries[0]?.total_hours_worked || 0;
      
      // Calculate efficiency metrics
      emp.tasks_per_hour = formatTasksPerHour(emp.tasks_completed, emp.total_hours_worked);
      emp.completion_rate = formatCompletionRate(emp.tasks_completed, emp.total_tasks_assigned);
      emp.task_hours_ratio = formatTaskHoursRatio(emp.total_task_hours, emp.total_hours_worked);
    }

    res.json({ 
      employees,
      period: { start_date: startDate, end_date: endDate }
    });
  } catch (error) {
    console.error('Employee performance analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/task-efficiency - Get task-level efficiency metrics
router.get('/task-efficiency', async (req, res) => {
  try {
    const { user_id, start_date, end_date, category } = req.query;
    
    let query = `
      SELECT 
        t.id,
        t.title,
        t.category,
        t.priority,
        t.status,
        t.assigned_to,
        u.full_name as assigned_to_name,
        t.started_at,
        t.completed_at,
        t.created_at,
        CASE 
          WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL 
          THEN (julianday(t.completed_at) - julianday(t.started_at)) * 24 
            - COALESCE((
              SELECT SUM((julianday(tb.break_end) - julianday(tb.break_start)) * 24)
              FROM task_breaks tb
              WHERE tb.task_id = t.id
                AND tb.break_start >= t.started_at
                AND tb.break_end IS NOT NULL
                AND tb.break_end <= t.completed_at
            ), 0)
          ELSE NULL 
        END as duration_hours,
        COUNT(DISTINCT ts.id) as total_subtasks,
        COUNT(DISTINCT CASE WHEN ts.is_completed = 1 THEN ts.id END) as completed_subtasks
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN task_subtasks ts ON t.id = ts.task_id
      WHERE t.assigned_to IS NOT NULL
    `;
    
    const params = [];
    
    if (user_id) {
      query += ' AND t.assigned_to = ?';
      params.push(user_id);
    }
    
    if (start_date) {
      query += ' AND DATE(t.created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND DATE(t.created_at) <= ?';
      params.push(end_date);
    }
    
    if (category) {
      query += ' AND t.category = ?';
      params.push(category);
    }
    
    query += ' GROUP BY t.id, t.title, t.category, t.priority, t.status, t.assigned_to, u.full_name, t.started_at, t.completed_at, t.created_at';
    query += ' ORDER BY t.created_at DESC';
    query += ' LIMIT 500';

    const tasks = await db.allAsync(query, params);

    // Calculate subtask completion rate
    for (let task of tasks) {
      task.subtask_completion_rate = formatSubtaskCompletionRate(task.completed_subtasks, task.total_subtasks);
    }

    res.json({ tasks });
  } catch (error) {
    console.error('Task efficiency analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/weekly-comparison - Compare employee performance week over week
router.get('/weekly-comparison', async (req, res) => {
  try {
    const { user_id, weeks = 4 } = req.query;
    const numWeeks = coerceAnalyticsWeekCount(weeks);
    
    const weeksData = [];
    const today = new Date();
    
    for (let i = 0; i < numWeeks; i++) {
      const { startDate, endDate } = getWeeklyComparisonWeekRange(today, i);
      
      let query = `
        SELECT 
          u.id,
          u.full_name,
          COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as tasks_completed,
          SUM(CASE 
            WHEN te.clock_out IS NOT NULL 
            THEN (julianday(te.clock_out) - julianday(te.clock_in)) * 24 - (te.break_minutes / 60.0)
            ELSE 0 
          END) as hours_worked
        FROM users u
        LEFT JOIN tasks t ON t.assigned_to = u.id 
          AND DATE(t.completed_at) >= ? 
          AND DATE(t.completed_at) <= ?
          AND t.status = 'completed'
        LEFT JOIN time_entries te ON te.user_id = u.id
          AND DATE(te.clock_in) >= ?
          AND DATE(te.clock_in) <= ?
          AND te.clock_out IS NOT NULL
        WHERE u.is_active = 1
      `;
      
      const params = [startDate, endDate, startDate, endDate];
      
      if (user_id) {
        query += ' AND u.id = ?';
        params.push(user_id);
      }
      
      query += ' GROUP BY u.id, u.full_name';
      
      const weekData = await db.allAsync(query, params);
      
      // Calculate efficiency for each employee
      for (let emp of weekData) {
        emp.tasks_per_hour = formatTasksPerHour(emp.tasks_completed, emp.hours_worked);
      }
      
      weeksData.push({
        week_start: startDate,
        week_end: endDate,
        week_label: weekComparisonLabel(numWeeks, i, startDate, endDate),
        employees: weekData
      });
    }
    
    res.json({ weeks: weeksData.reverse() }); // Reverse to show oldest first
  } catch (error) {
    console.error('Weekly comparison analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/category-breakdown - Breakdown by task category
router.get('/category-breakdown', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        t.category,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
        AVG(CASE 
          WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL 
          THEN (julianday(t.completed_at) - julianday(t.started_at)) * 24 
            - COALESCE((
              SELECT SUM((julianday(tb.break_end) - julianday(tb.break_start)) * 24)
              FROM task_breaks tb
              WHERE tb.task_id = t.id
                AND tb.break_start >= t.started_at
                AND tb.break_end IS NOT NULL
                AND tb.break_end <= t.completed_at
            ), 0)
          ELSE NULL 
        END) as avg_duration_hours,
        COUNT(DISTINCT t.assigned_to) as employees_working_on
      FROM tasks t
      WHERE t.category IS NOT NULL
    `;
    
    const params = [];
    
    if (start_date) {
      query += ' AND DATE(t.created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND DATE(t.created_at) <= ?';
      params.push(end_date);
    }
    
    query += ' GROUP BY t.category';
    query += ' ORDER BY total_tasks DESC';

    const categories = await db.allAsync(query, params);
    
    for (let cat of categories) {
      cat.completion_rate = formatCompletionRate(cat.completed_tasks, cat.total_tasks);
    }

    res.json({ categories });
  } catch (error) {
    console.error('Category breakdown analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/employee-detail/:id - Detailed metrics for a specific employee
router.get('/employee-detail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;
    
    // Get employee info
    const employee = await db.getAsync(
      'SELECT id, full_name, username, role, hourly_rate, weekly_salary FROM users WHERE id = ?',
      [id]
    );
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    // Default to current week
    let startDate = start_date;
    let endDate = end_date;
    
    if (!startDate || !endDate) {
      const range = getDefaultAnalyticsWeekRange();
      startDate = range.startDate;
      endDate = range.endDate;
    }
    
    // Get task statistics
    const taskStats = await db.getAsync(`
      SELECT 
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'todo' THEN t.id END) as todo_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'review' THEN t.id END) as review_tasks,
        SUM(CASE 
          WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL 
          THEN (julianday(t.completed_at) - julianday(t.started_at)) * 24 
            - COALESCE((
              SELECT SUM((julianday(tb.break_end) - julianday(tb.break_start)) * 24)
              FROM task_breaks tb
              WHERE tb.task_id = t.id
                AND tb.break_start >= t.started_at
                AND tb.break_end IS NOT NULL
                AND tb.break_end <= t.completed_at
            ), 0)
          ELSE 0 
        END) as total_task_hours,
        AVG(CASE 
          WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL 
          THEN (julianday(t.completed_at) - julianday(t.started_at)) * 24 
            - COALESCE((
              SELECT SUM((julianday(tb.break_end) - julianday(tb.break_start)) * 24)
              FROM task_breaks tb
              WHERE tb.task_id = t.id
                AND tb.break_start >= t.started_at
                AND tb.break_end IS NOT NULL
                AND tb.break_end <= t.completed_at
            ), 0)
          ELSE NULL 
        END) as avg_task_duration_hours,
        MIN(CASE 
          WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL 
          THEN (julianday(t.completed_at) - julianday(t.started_at)) * 24 
            - COALESCE((
              SELECT SUM((julianday(tb.break_end) - julianday(tb.break_start)) * 24)
              FROM task_breaks tb
              WHERE tb.task_id = t.id
                AND tb.break_start >= t.started_at
                AND tb.break_end IS NOT NULL
                AND tb.break_end <= t.completed_at
            ), 0)
          ELSE NULL 
        END) as min_task_duration_hours,
        MAX(CASE 
          WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL 
          THEN (julianday(t.completed_at) - julianday(t.started_at)) * 24 
            - COALESCE((
              SELECT SUM((julianday(tb.break_end) - julianday(tb.break_start)) * 24)
              FROM task_breaks tb
              WHERE tb.task_id = t.id
                AND tb.break_start >= t.started_at
                AND tb.break_end IS NOT NULL
                AND tb.break_end <= t.completed_at
            ), 0)
          ELSE NULL 
        END) as max_task_duration_hours
      FROM tasks t
      WHERE t.assigned_to = ?
        AND DATE(t.created_at) >= ?
        AND DATE(t.created_at) <= ?
    `, [id, startDate, endDate]);
    
    // Get time entry statistics
    const timeStats = await db.getAsync(`
      SELECT 
        COUNT(DISTINCT DATE(clock_in)) as days_worked,
        SUM(CASE 
          WHEN clock_out IS NOT NULL 
          THEN (julianday(clock_out) - julianday(clock_in)) * 24 - (break_minutes / 60.0)
          ELSE 0 
        END) as total_hours_worked,
        AVG(CASE 
          WHEN clock_out IS NOT NULL 
          THEN (julianday(clock_out) - julianday(clock_in)) * 24 - (break_minutes / 60.0)
          ELSE NULL 
        END) as avg_hours_per_day
      FROM time_entries
      WHERE user_id = ?
        AND DATE(clock_in) >= ?
        AND DATE(clock_in) <= ?
        AND clock_out IS NOT NULL
    `, [id, startDate, endDate]);
    
    // Get category breakdown
    const categoryBreakdown = await db.allAsync(`
      SELECT 
        t.category,
        COUNT(DISTINCT t.id) as task_count,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_count,
        AVG(CASE 
          WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL 
          THEN (julianday(t.completed_at) - julianday(t.started_at)) * 24 
            - COALESCE((
              SELECT SUM((julianday(tb.break_end) - julianday(tb.break_start)) * 24)
              FROM task_breaks tb
              WHERE tb.task_id = t.id
                AND tb.break_start >= t.started_at
                AND tb.break_end IS NOT NULL
                AND tb.break_end <= t.completed_at
            ), 0)
          ELSE NULL 
        END) as avg_duration_hours
      FROM tasks t
      WHERE t.assigned_to = ?
        AND DATE(t.created_at) >= ?
        AND DATE(t.created_at) <= ?
      GROUP BY t.category
      ORDER BY task_count DESC
    `, [id, startDate, endDate]);
    
    // Calculate efficiency metrics
    const totalHoursWorked = timeStats?.total_hours_worked || 0;
    const tasksCompleted = taskStats?.completed_tasks || 0;
    const totalTaskHours = taskStats?.total_task_hours || 0;
    
    const efficiency = {
      tasks_per_hour: formatTasksPerHour(tasksCompleted, totalHoursWorked),
      completion_rate: formatCompletionRate(tasksCompleted, taskStats?.total_tasks),
      task_hours_ratio: formatTaskHoursRatio(totalTaskHours, totalHoursWorked),
      utilization_rate: formatTaskHoursRatio(totalTaskHours, totalHoursWorked)
    };
    
    res.json({
      employee,
      period: { start_date: startDate, end_date: endDate },
      task_stats: taskStats,
      time_stats: timeStats,
      category_breakdown: categoryBreakdown,
      efficiency
    });
  } catch (error) {
    console.error('Employee detail analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

