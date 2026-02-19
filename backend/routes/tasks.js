import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { sanitizeInput, toTitleCase } from '../utils/helpers.js';
import { syncTaskCompletionToShopMonkey } from '../utils/shopmonkey.js';
import {
  estimateTaskTime,
  suggestTaskAssignment,
  categorizeTask,
  generateQualityChecks,
  generateRecommendations,
  isAIEnabled,
  isAIEnabledSync
} from '../utils/aiService.js';
import {
  calculateTaskWorkingTime,
  calculateTaskTotalDuration,
  getCurrentElapsedTime
} from '../utils/taskTimeTracking.js';

/**
 * Helper function to add time tracking data to a task object
 * Ensures all tasks returned from API have consistent time tracking data
 */
async function addTimeTrackingToTask(task, db) {
  if (!task) return task;
  
  // Get breaks for the task
  let breaks = [];
  try {
    breaks = await db.allAsync(`
      SELECT tb.*, u.full_name as user_name
      FROM task_breaks tb
      LEFT JOIN users u ON tb.user_id = u.id
      WHERE tb.task_id = ?
      ORDER BY tb.break_start DESC
    `, [task.id]) || [];
  } catch (breakError) {
    // Table might not exist, just set empty breaks
    breaks = [];
  }
  
  task.breaks = breaks;
  task.active_break = breaks.find(b => !b.break_end) || null;
  
  // Find the most recent restart time
  const completedBreaks = breaks.filter(b => b.break_end);
  if (completedBreaks.length > 0) {
    completedBreaks.sort((a, b) => new Date(b.break_end) - new Date(a.break_end));
    task.last_restarted_at = completedBreaks[0].break_end;
    task.last_restarted_by = completedBreaks[0].user_name;
  } else {
    task.last_restarted_at = null;
    task.last_restarted_by = null;
  }
  
  // Calculate time tracking data
  task.timeTracking = calculateTaskWorkingTime(task);
  task.totalDuration = calculateTaskTotalDuration(task);
  
  return task;
}

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Ensure tasks table has is_archived (idempotent) so GET /tasks doesn't 500 on older DBs
async function ensureTasksArchivedColumn() {
  try {
    const cols = await db.allAsync('PRAGMA table_info(tasks)');
    const hasArchived = (cols || []).some(c => c.name === 'is_archived');
    if (!hasArchived) {
      await db.runAsync('ALTER TABLE tasks ADD COLUMN is_archived BOOLEAN DEFAULT 0');
    }
  } catch (_) {}
}

// GET /api/tasks - Get tasks (filtered by user for employees, all for admin)
router.get('/', async (req, res) => {
  try {
    await ensureTasksArchivedColumn();

    const { search, include_archived, status } = req.query;
    let tasks;
    let query = `
      SELECT t.*, 
             u1.full_name as assigned_to_name,
             u2.full_name as created_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by user role - employees see tasks assigned to them (via task_assignments) or created by them
    if (req.user.role !== 'admin') {
      query += ` AND (
        t.created_by = ? 
        OR t.assigned_to = ? 
        OR EXISTS (
          SELECT 1 FROM task_assignments ta 
          WHERE ta.task_id = t.id AND ta.user_id = ?
        )
      )`;
      params.push(req.user.id, req.user.id, req.user.id);
    }

    // Filter archived tasks
    if (include_archived !== 'true') {
      query += ' AND (t.is_archived = 0 OR t.is_archived IS NULL)';
    }

    // Filter by status (supports comma-separated list)
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(s => s);
      if (statuses.length > 0) {
        const placeholders = statuses.map(() => '?').join(',');
        query += ` AND t.status IN (${placeholders})`;
        params.push(...statuses);
      }
    }

    // Search functionality
    if (search) {
      query += ' AND (t.title LIKE ? OR t.description LIKE ? OR u1.full_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY t.created_at DESC';

    try {
      tasks = await db.allAsync(query, params);
    } catch (queryErr) {
      const msg = String(queryErr?.message || '');
      if (req.user.role !== 'admin' && (msg.includes('task_assignments') || msg.includes('no such table'))) {
        let fallbackQuery = `
          SELECT t.*, u1.full_name as assigned_to_name, u2.full_name as created_by_name
          FROM tasks t
          LEFT JOIN users u1 ON t.assigned_to = u1.id
          LEFT JOIN users u2 ON t.created_by = u2.id
          WHERE 1=1 AND (t.created_by = ? OR t.assigned_to = ?)
        `;
        const fallbackParams = [req.user.id, req.user.id];
        if (include_archived !== 'true') {
          fallbackQuery += ' AND (t.is_archived = 0 OR t.is_archived IS NULL)';
        }
        if (status) {
          const statuses = status.split(',').map(s => s.trim()).filter(s => s);
          if (statuses.length > 0) {
            fallbackQuery += ` AND t.status IN (${statuses.map(() => '?').join(',')})`;
            fallbackParams.push(...statuses);
          }
        }
        if (search) {
          fallbackQuery += ' AND (t.title LIKE ? OR t.description LIKE ? OR u1.full_name LIKE ?)';
          const searchTerm = `%${search}%`;
          fallbackParams.push(searchTerm, searchTerm, searchTerm);
        }
        fallbackQuery += ' ORDER BY t.created_at DESC';
        tasks = await db.allAsync(fallbackQuery, fallbackParams);
      } else {
        throw queryErr;
      }
    }

    // Get comments, subtasks, and assignments for each task
    for (let task of tasks) {
      const comments = await db.allAsync(`
        SELECT tc.*, u.full_name as user_name, u.username
        FROM task_comments tc
        LEFT JOIN users u ON tc.user_id = u.id
        WHERE tc.task_id = ?
        ORDER BY tc.created_at ASC
      `, [task.id]);
      task.comments = comments;

      const subtasks = await db.allAsync(`
        SELECT ts.*, u.full_name as completed_by_name
        FROM task_subtasks ts
        LEFT JOIN users u ON ts.completed_by = u.id
        WHERE ts.task_id = ?
        ORDER BY ts.order_index ASC, ts.created_at ASC
      `, [task.id]);
      task.subtasks = subtasks || [];
      
      // Get all assigned users (new many-to-many relationship)
      let assignments = [];
      try {
        assignments = await db.allAsync(`
          SELECT ta.user_id, u.full_name as assigned_to_name, ta.assigned_at
          FROM task_assignments ta
          LEFT JOIN users u ON ta.user_id = u.id
          WHERE ta.task_id = ?
          ORDER BY ta.assigned_at ASC
        `, [task.id]) || [];
      } catch (_) {
        assignments = [];
      }
      task.assigned_users = assignments.map(a => ({
        user_id: a.user_id,
        full_name: a.assigned_to_name,
        assigned_at: a.assigned_at
      }));
      
      // Get task breaks (with error handling in case table doesn't exist)
      let breaks = [];
      try {
        breaks = await db.allAsync(`
          SELECT tb.*, u.full_name as user_name
          FROM task_breaks tb
          LEFT JOIN users u ON tb.user_id = u.id
          WHERE tb.task_id = ?
          ORDER BY tb.break_start DESC
        `, [task.id]) || [];
      } catch (breakError) {
        // Table might not exist yet, just set empty breaks
        console.warn('Error fetching task breaks (table may not exist):', breakError.message);
        breaks = [];
      }
      
      // Get lunch breaks from time_entries that overlap with task time period
      // Only if task has started_at (completed_at is optional for in-progress tasks)
      if (task.started_at && task.started_by) {
        try {
          // Use completed_at if available, otherwise use a far future date to catch all breaks
          const taskEndTime = task.completed_at || '9999-12-31 23:59:59';
          
          const lunchBreaks = await db.allAsync(`
            SELECT 
              te.clock_out as break_start,
              te2.clock_in as break_end,
              te.break_minutes,
              'Lunch break' as reason,
              te.notes
            FROM time_entries te
            LEFT JOIN time_entries te2 ON 
              te2.user_id = te.user_id 
              AND te2.clock_in > te.clock_out
              AND (te2.notes IS NULL OR te2.notes NOT LIKE '%Lunch break%')
            WHERE te.user_id = ?
              AND te.notes LIKE '%Lunch break%'
              AND te.clock_out IS NOT NULL
              AND te.clock_out >= ?
              AND (te2.clock_in IS NULL OR te2.clock_in <= ?)
            ORDER BY te.clock_out ASC
          `, [task.started_by, task.started_at, taskEndTime]);
          
          // Convert lunch breaks to same format as task breaks
          if (lunchBreaks && lunchBreaks.length > 0) {
            lunchBreaks.forEach(lb => {
              // Include both completed breaks (with break_end) and active breaks (without break_end)
              if (lb.break_start) {
                breaks.push({
                  break_start: lb.break_start,
                  break_end: lb.break_end || null, // null for active breaks
                  reason: lb.reason || 'Lunch break',
                  notes: lb.notes,
                  user_name: task.started_by_name || 'Unknown'
                });
              }
            });
          }
        } catch (lunchError) {
          // If there's an error fetching lunch breaks, just continue without them
          console.warn('Error fetching lunch breaks for task:', lunchError.message);
        }
      }
      
      task.breaks = breaks;
      
      // Check if there's an active break (break_end is NULL)
      task.active_break = breaks.find(b => !b.break_end) || null;
      
      // Find the most recent restart time (most recent break_end)
      const completedBreaks = breaks.filter(b => b.break_end);
      if (completedBreaks.length > 0) {
        // Sort by break_end descending to get the most recent
        completedBreaks.sort((a, b) => new Date(b.break_end) - new Date(a.break_end));
        task.last_restarted_at = completedBreaks[0].break_end;
        task.last_restarted_by = completedBreaks[0].user_name;
      } else {
        task.last_restarted_at = null;
        task.last_restarted_by = null;
      }
      
      // Keep backward compatibility: set assigned_to_name from first assignment or legacy field
      if (assignments.length > 0) {
        task.assigned_to_name = assignments.map(a => a.assigned_to_name).join(', ');
        task.assigned_to = assignments[0].user_id; // Keep first one for backward compatibility
      }
      
      // Add started_by_name and completed_by_name to task
      if (task.started_by) {
        const startedByUser = await db.getAsync('SELECT full_name FROM users WHERE id = ?', [task.started_by]);
        task.started_by_name = startedByUser?.full_name || null;
      }
      if (task.completed_by) {
        const completedByUser = await db.getAsync('SELECT full_name FROM users WHERE id = ?', [task.completed_by]);
        task.completed_by_name = completedByUser?.full_name || null;
      }

      // Task inventory usage (parts & materials linked to this task)
      try {
        const usage = await db.allAsync(`
          SELECT u.id, u.task_id, u.item_id, u.quantity_used, u.created_at,
                 i.name AS item_name, i.unit AS item_unit, i.quantity AS item_quantity,
                 i.needs_return, i.returned_at,
                 i.category_id, c.name AS category_name
          FROM task_inventory_usage u
          JOIN inventory_items i ON i.id = u.item_id
          LEFT JOIN inventory_categories c ON c.id = i.category_id
          WHERE u.task_id = ?
          ORDER BY u.created_at ASC
        `, [task.id]);
        task.inventory_usage = usage || [];
      } catch (invErr) {
        task.inventory_usage = [];
      }
    }

    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    return res.json({ tasks: [] });
  }
});

// POST /api/tasks - Create new task
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, description, assigned_to, assigned_users, status, priority, category, due_date, estimated_time_minutes, subtasks, started_at, completed_at, started_by, shopmonkey_order_id, shopmonkey_order_number } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Task title required' });
    }

    // Support both old assigned_to (single) and new assigned_users (array)
    const userIds = assigned_users && Array.isArray(assigned_users) 
      ? assigned_users.filter(id => id) 
      : (assigned_to ? [assigned_to] : []);
    const firstUserId = userIds.length > 0 ? userIds[0] : null;

    // Parse time tracking fields if provided
    let startedAtISO = null;
    if (started_at) {
      const startedDate = new Date(started_at);
      if (!isNaN(startedDate.getTime())) {
        startedAtISO = startedDate.toISOString();
      }
    }

    let completedAtISO = null;
    if (completed_at) {
      const completedDate = new Date(completed_at);
      if (!isNaN(completedDate.getTime())) {
        completedAtISO = completedDate.toISOString();
      }
    }

    // Validate started_by if provided
    const startedById = started_by || (startedAtISO ? req.user.id : null);

    // Auto-categorize if category not provided and AI is enabled
    let finalCategory = category || 'Other';
    let aiSuggestedCategory = null;
    
    if (!category && isAIEnabledSync()) {
      try {
        const categoryResult = await categorizeTask(title, description || '');
        if (categoryResult && categoryResult.category) {
          finalCategory = categoryResult.category;
          aiSuggestedCategory = categoryResult.category;
        }
      } catch (catError) {
        console.warn('Auto-categorization failed:', catError);
        // Continue with default category
      }
    }

    const result = await db.runAsync(
      `INSERT INTO tasks (title, description, assigned_to, created_by, status, priority, category, due_date, estimated_time_minutes, started_at, completed_at, started_by, shopmonkey_order_id, shopmonkey_order_number, ai_suggested_category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        toTitleCase(sanitizeInput(title)),
        description ? sanitizeInput(description) : null,
        firstUserId, // Keep for backward compatibility
        req.user.id,
        status || 'todo',
        priority || 'medium',
        finalCategory,
        due_date || null,
        estimated_time_minutes || null,
        startedAtISO,
        completedAtISO,
        startedById,
        shopmonkey_order_id || null,
        shopmonkey_order_number || null,
        aiSuggestedCategory
      ]
    );

    const taskId = result.lastID;

    // Add task assignments (many-to-many)
    if (userIds.length > 0) {
      for (const userId of userIds) {
        await db.runAsync(
          'INSERT OR IGNORE INTO task_assignments (task_id, user_id, assigned_by, assigned_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
          [taskId, userId, req.user.id]
        );
      }
    }

    // Add subtasks if provided
    if (subtasks && Array.isArray(subtasks)) {
      for (let i = 0; i < subtasks.length; i++) {
        const subtask = subtasks[i];
        if (subtask.title && subtask.title.trim()) {
          await db.runAsync(
            'INSERT INTO task_subtasks (task_id, title, order_index) VALUES (?, ?, ?)',
            [taskId, toTitleCase(sanitizeInput(subtask.title)), i]
          );
        }
      }
    }

    const newTask = await db.getAsync(`
      SELECT t.*, 
             u1.full_name as assigned_to_name,
             u2.full_name as created_by_name,
             u3.full_name as started_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      LEFT JOIN users u3 ON t.started_by = u3.id
      WHERE t.id = ?
    `, [taskId]);

    // Get assigned users
    const assignments = await db.allAsync(`
      SELECT ta.user_id, u.full_name as assigned_to_name
      FROM task_assignments ta
      LEFT JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
      ORDER BY ta.assigned_at ASC
    `, [taskId]);
    newTask.assigned_users = assignments.map(a => ({
      user_id: a.user_id,
      full_name: a.assigned_to_name
    }));
    if (assignments.length > 0) {
      newTask.assigned_to_name = assignments.map(a => a.assigned_to_name).join(', ');
    }

    // Get subtasks
    const taskSubtasks = await db.allAsync(`
      SELECT ts.*, u.full_name as completed_by_name
      FROM task_subtasks ts
      LEFT JOIN users u ON ts.completed_by = u.id
      WHERE ts.task_id = ?
      ORDER BY ts.order_index ASC
    `, [taskId]);
    newTask.subtasks = taskSubtasks || [];

    // Get task breaks (empty for new task)
    newTask.breaks = [];
    newTask.active_break = null;

    // Log history
    await db.runAsync(
      'INSERT INTO task_history (task_id, changed_by, field_changed, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
      [taskId, req.user.id, 'created', null, 'Task created']
    );

    res.status(201).json({ task: newTask });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id - Update task (admin can edit fully)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, assigned_to, assigned_users, status, priority, category, due_date, estimated_time_minutes, subtasks, started_at, started_by, completed_at, completed_by } = req.body;

    // Get current task
    const currentTask = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get current assignments
    const currentAssignments = await db.allAsync('SELECT user_id FROM task_assignments WHERE task_id = ?', [id]);
    const currentUserIds = currentAssignments.map(a => a.user_id);

    // Employees can only update their own tasks, admins can update any
    // Check if user is assigned to this task (via new assignments table)
    if (req.user.role !== 'admin' && !currentUserIds.includes(req.user.id)) {
      return res.status(403).json({ error: 'You can only update tasks assigned to you' });
    }

    // Support both old assigned_to (single) and new assigned_users (array)
    let userIds = null;
    if (assigned_users !== undefined && Array.isArray(assigned_users)) {
      userIds = assigned_users.filter(id => id);
    } else if (assigned_to !== undefined) {
      userIds = assigned_to ? [assigned_to] : [];
    }

    const firstUserId = userIds !== null && userIds.length > 0 ? userIds[0] : null;

    // Track changes for history
    const changes = [];
    if (title !== undefined && title !== currentTask.title) {
      changes.push({ field: 'title', old: currentTask.title, new: title });
    }
    if (status !== undefined && status !== currentTask.status) {
      changes.push({ field: 'status', old: currentTask.status, new: status });
    }
    if (userIds !== null) {
      const oldUserIds = currentUserIds.sort().join(',');
      const newUserIds = userIds.sort().join(',');
      if (oldUserIds !== newUserIds) {
        changes.push({ field: 'assigned_users', old: oldUserIds || 'none', new: newUserIds || 'none' });
      }
    }

    // Build update query dynamically to handle optional time tracking fields (admin only)
    const updateFields = [];
    const updateValues = [];
    
    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(toTitleCase(sanitizeInput(title)));
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description ? sanitizeInput(description) : null);
    }
    if (userIds !== null) {
      updateFields.push('assigned_to = ?');
      updateValues.push(firstUserId);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
      
      // Auto-set completed_at when status changes to 'completed' if not already set
      if (status === 'completed' && currentTask.status !== 'completed' && !currentTask.completed_at && completed_at === undefined) {
        updateFields.push('completed_at = ?');
        updateFields.push('completed_by = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(req.user.id);
      }
      // Clear completed_at when status changes away from 'completed'
      else if (status !== 'completed' && currentTask.status === 'completed' && completed_at === undefined) {
        updateFields.push('completed_at = NULL');
        updateFields.push('completed_by = NULL');
      }
    }
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(priority);
    }
    if (category !== undefined) {
      updateFields.push('category = ?');
      updateValues.push(category);
    }
    if (due_date !== undefined) {
      updateFields.push('due_date = ?');
      updateValues.push(due_date);
    }
    if (estimated_time_minutes !== undefined) {
      updateFields.push('estimated_time_minutes = ?');
      updateValues.push(estimated_time_minutes ? estimated_time_minutes : null);
    }
    
    // Time tracking fields (admin only)
    if (req.user.role === 'admin') {
      if (started_at !== undefined) {
        updateFields.push('started_at = ?');
        updateValues.push(started_at ? started_at : null);
      }
      if (started_by !== undefined) {
        updateFields.push('started_by = ?');
        updateValues.push(started_by ? started_by : null);
      }
      if (completed_at !== undefined) {
        updateFields.push('completed_at = ?');
        updateValues.push(completed_at ? completed_at : null);
      }
      if (completed_by !== undefined) {
        updateFields.push('completed_by = ?');
        updateValues.push(completed_by ? completed_by : null);
      }
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    
    await db.runAsync(
      `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Update task assignments if provided
    if (userIds !== null) {
      // Remove all existing assignments
      await db.runAsync('DELETE FROM task_assignments WHERE task_id = ?', [id]);
      
      // Add new assignments
      if (userIds.length > 0) {
        for (const userId of userIds) {
          await db.runAsync(
            'INSERT INTO task_assignments (task_id, user_id, assigned_by, assigned_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
            [id, userId, req.user.id]
          );
        }
      }
    }

    // Update subtasks if provided (admin only)
    if (subtasks !== undefined && req.user.role === 'admin') {
      // Delete existing subtasks
      await db.runAsync('DELETE FROM task_subtasks WHERE task_id = ?', [id]);
      
      // Insert new subtasks
      if (Array.isArray(subtasks)) {
        for (let i = 0; i < subtasks.length; i++) {
          const subtask = subtasks[i];
          if (subtask.title && subtask.title.trim()) {
            await db.runAsync(
              'INSERT INTO task_subtasks (task_id, title, order_index, is_completed, completed_at, completed_by) VALUES (?, ?, ?, ?, ?, ?)',
              [
                id,
                toTitleCase(sanitizeInput(subtask.title)),
                i,
                subtask.is_completed ? 1 : 0,
                subtask.is_completed ? subtask.completed_at || new Date().toISOString() : null,
                subtask.completed_by || null
              ]
            );
          }
        }
      }
    }

    // Log history
    for (const change of changes) {
      await db.runAsync(
        'INSERT INTO task_history (task_id, changed_by, field_changed, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
        [id, req.user.id, change.field, String(change.old), String(change.new)]
      );
    }

    // Sync to ShopMonkey if task status changed to completed and has a ShopMonkey order ID
    if (status !== undefined && status === 'completed' && currentTask.status !== 'completed' && currentTask.shopmonkey_order_id) {
      try {
        const syncResult = await syncTaskCompletionToShopMonkey(currentTask.shopmonkey_order_id, {
          note: `Task "${currentTask.title}" marked as completed in Spectrum Outfitters Calendar`
        });
        console.log('ShopMonkey sync successful:', syncResult);
      } catch (syncError) {
        // Don't fail the request if ShopMonkey sync fails, just log it
        console.error('ShopMonkey sync failed (non-blocking):', syncError.message);
      }
    }

    const updatedTask = await db.getAsync(`
      SELECT t.*, 
             u1.full_name as assigned_to_name,
             u2.full_name as created_by_name,
             u3.full_name as started_by_name,
             u4.full_name as completed_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      LEFT JOIN users u3 ON t.started_by = u3.id
      LEFT JOIN users u4 ON t.completed_by = u4.id
      WHERE t.id = ?
    `, [id]);

    // Get assigned users
    const assignments = await db.allAsync(`
      SELECT ta.user_id, u.full_name as assigned_to_name
      FROM task_assignments ta
      LEFT JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
      ORDER BY ta.assigned_at ASC
    `, [id]);
    updatedTask.assigned_users = assignments.map(a => ({
      user_id: a.user_id,
      full_name: a.assigned_to_name
    }));
    if (assignments.length > 0) {
      updatedTask.assigned_to_name = assignments.map(a => a.assigned_to_name).join(', ');
    }

    // Get subtasks
    const taskSubtasks = await db.allAsync(`
      SELECT ts.*, u.full_name as completed_by_name
      FROM task_subtasks ts
      LEFT JOIN users u ON ts.completed_by = u.id
      WHERE ts.task_id = ?
      ORDER BY ts.order_index ASC
    `, [id]);
    updatedTask.subtasks = taskSubtasks || [];

    // Get task breaks (with error handling in case table doesn't exist)
    let breaks = [];
    try {
      breaks = await db.allAsync(`
        SELECT tb.*, u.full_name as user_name
        FROM task_breaks tb
        LEFT JOIN users u ON tb.user_id = u.id
        WHERE tb.task_id = ?
        ORDER BY tb.break_start DESC
      `, [id]) || [];
    } catch (breakError) {
      // Table might not exist yet, just set empty breaks
      console.warn('Error fetching task breaks (table may not exist):', breakError.message);
      breaks = [];
    }
    
    // Get lunch breaks from time_entries that overlap with task time period
    // Only if task has started_at (completed_at is optional for in-progress tasks)
    if (updatedTask.started_at && updatedTask.started_by) {
      try {
        // Use completed_at if available, otherwise use a far future date to catch all breaks
        const taskEndTime = updatedTask.completed_at || '9999-12-31 23:59:59';
        
        const lunchBreaks = await db.allAsync(`
          SELECT 
            te.clock_out as break_start,
            te2.clock_in as break_end,
            te.break_minutes,
            'Lunch break' as reason,
            te.notes
          FROM time_entries te
          LEFT JOIN time_entries te2 ON 
            te2.user_id = te.user_id 
            AND te2.clock_in > te.clock_out
            AND (te2.notes IS NULL OR te2.notes NOT LIKE '%Lunch break%')
          WHERE te.user_id = ?
            AND te.notes LIKE '%Lunch break%'
            AND te.clock_out IS NOT NULL
            AND te.clock_out >= ?
            AND (te2.clock_in IS NULL OR te2.clock_in <= ?)
          ORDER BY te.clock_out ASC
        `, [updatedTask.started_by, updatedTask.started_at, taskEndTime]);
        
        // Convert lunch breaks to same format as task breaks
        if (lunchBreaks && lunchBreaks.length > 0) {
          lunchBreaks.forEach(lb => {
            // Include both completed breaks (with break_end) and active breaks (without break_end)
            if (lb.break_start) {
              breaks.push({
                break_start: lb.break_start,
                break_end: lb.break_end || null, // null for active breaks
                reason: lb.reason || 'Lunch break',
                notes: lb.notes,
                user_name: updatedTask.started_by_name || 'Unknown'
              });
            }
          });
        }
      } catch (lunchError) {
        console.warn('Error fetching lunch breaks for task:', lunchError.message);
      }
    }
    
    updatedTask.breaks = breaks;
    updatedTask.active_break = breaks.find(b => !b.break_end) || null;

    // Find the most recent restart time (most recent break_end)
    const completedBreaks = breaks.filter(b => b.break_end);
    if (completedBreaks.length > 0) {
      // Sort by break_end descending to get the most recent
      completedBreaks.sort((a, b) => new Date(b.break_end) - new Date(a.break_end));
      updatedTask.last_restarted_at = completedBreaks[0].break_end;
      updatedTask.last_restarted_by = completedBreaks[0].user_name;
    } else {
      updatedTask.last_restarted_at = null;
      updatedTask.last_restarted_by = null;
    }
    
    // Calculate time tracking data
    updatedTask.timeTracking = calculateTaskWorkingTime(updatedTask);
    updatedTask.totalDuration = calculateTaskTotalDuration(updatedTask);

    res.json({ task: updatedTask });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/:id/start - Start working on a task
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get current task
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Employees can only start tasks they are associated with
    // (assigned via legacy assigned_to, new task_assignments, or created_by)
    if (req.user.role !== 'admin') {
      let isAssigned = task.assigned_to === req.user.id || task.created_by === req.user.id;
      if (!isAssigned) {
        try {
          const assignments = await db.allAsync(
            'SELECT user_id FROM task_assignments WHERE task_id = ?',
            [id]
          );
          isAssigned = (assignments || []).some(a => a.user_id === req.user.id);
        } catch (_) {
          // If assignments table doesn't exist, fall back to legacy check above
        }
      }

      if (!isAssigned) {
        return res.status(403).json({ error: 'You can only start tasks assigned to you' });
      }
    }

    // Check if task is already started
    if (task.started_at) {
      return res.status(400).json({ error: 'Task has already been started' });
    }

    // Start the task
    await db.runAsync(
      'UPDATE tasks SET started_at = ?, started_by = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [new Date().toISOString(), req.user.id, task.status === 'todo' ? 'in_progress' : task.status, id]
    );

    const updatedTask = await db.getAsync(`
      SELECT t.*, 
             u1.full_name as assigned_to_name,
             u2.full_name as created_by_name,
             u3.full_name as started_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      LEFT JOIN users u3 ON t.started_by = u3.id
      WHERE t.id = ?
    `, [id]);

    // Get task breaks (with error handling in case table doesn't exist)
    let breaks = [];
    try {
      breaks = await db.allAsync(`
        SELECT tb.*, u.full_name as user_name
        FROM task_breaks tb
        LEFT JOIN users u ON tb.user_id = u.id
        WHERE tb.task_id = ?
        ORDER BY tb.break_start DESC
      `, [id]) || [];
    } catch (breakError) {
      // Table might not exist yet, just set empty breaks
      console.warn('Error fetching task breaks (table may not exist):', breakError.message);
      breaks = [];
    }
    updatedTask.breaks = breaks;
    updatedTask.active_break = breaks.find(b => !b.break_end) || null;

    // Find the most recent restart time (most recent break_end)
    const completedBreaks = breaks.filter(b => b.break_end);
    if (completedBreaks.length > 0) {
      // Sort by break_end descending to get the most recent
      completedBreaks.sort((a, b) => new Date(b.break_end) - new Date(a.break_end));
      updatedTask.last_restarted_at = completedBreaks[0].break_end;
      updatedTask.last_restarted_by = completedBreaks[0].user_name;
    } else {
      updatedTask.last_restarted_at = null;
      updatedTask.last_restarted_by = null;
    }
    
    // Calculate time tracking data
    updatedTask.timeTracking = calculateTaskWorkingTime(updatedTask);
    updatedTask.totalDuration = calculateTaskTotalDuration(updatedTask);

    res.json({ task: updatedTask });
  } catch (error) {
    console.error('Start task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id/status - Update task status only
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status required' });
    }

    const currentTask = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Employees can only update status on tasks they are associated with
    // (assigned via legacy assigned_to, new task_assignments, or created_by)
    if (req.user.role !== 'admin') {
      let isAssigned = currentTask.assigned_to === req.user.id || currentTask.created_by === req.user.id;
      if (!isAssigned) {
        try {
          const assignments = await db.allAsync(
            'SELECT user_id FROM task_assignments WHERE task_id = ?',
            [id]
          );
          isAssigned = (assignments || []).some(a => a.user_id === req.user.id);
        } catch (_) {
          // If assignments table doesn't exist, fall back to legacy check above
        }
      }

      if (!isAssigned) {
        return res.status(403).json({ error: 'You can only update tasks assigned to you' });
      }
    }

    // Track completion time when status changes to 'completed'
    let updateQuery = 'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const updateParams = [status];
    
    if (status === 'completed' && currentTask.status !== 'completed') {
      // Task is being completed
      updateQuery += ', completed_at = ?, completed_by = ?';
      updateParams.push(new Date().toISOString(), req.user.id);
    } else if (status !== 'completed' && currentTask.status === 'completed') {
      // Task is being un-completed (moved back from completed)
      updateQuery += ', completed_at = NULL, completed_by = NULL';
    }
    
    // Auto-start task if moving to in_progress and not started yet
    if (status === 'in_progress' && !currentTask.started_at) {
      updateQuery += ', started_at = ?, started_by = ?';
      updateParams.push(new Date().toISOString(), req.user.id);
    }
    
    updateQuery += ' WHERE id = ?';
    updateParams.push(id);

    await db.runAsync(updateQuery, updateParams);

    // Log history
    await db.runAsync(
      'INSERT INTO task_history (task_id, changed_by, field_changed, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, 'status', currentTask.status, status]
    );

    // Sync to ShopMonkey if task is completed and has a ShopMonkey order ID
    if (status === 'completed' && currentTask.status !== 'completed' && currentTask.shopmonkey_order_id) {
      try {
        const syncResult = await syncTaskCompletionToShopMonkey(currentTask.shopmonkey_order_id, {
          note: `Task "${currentTask.title}" marked as completed in Spectrum Outfitters Calendar`
        });
        console.log('ShopMonkey sync successful:', syncResult);
      } catch (syncError) {
        // Don't fail the request if ShopMonkey sync fails, just log it
        console.error('ShopMonkey sync failed (non-blocking):', syncError.message);
      }
    }

    const updatedTask = await db.getAsync(`
      SELECT t.*, 
             u1.full_name as assigned_to_name,
             u2.full_name as created_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.id = ?
    `, [id]);

    // Add time tracking data to the response
    await addTimeTrackingToTask(updatedTask, db);

    res.json({ task: updatedTask });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:id - Delete task (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if task exists
    const task = await db.getAsync('SELECT id FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Delete related records first (due to foreign key constraints)
    await db.runAsync('DELETE FROM task_comments WHERE task_id = ?', [id]);
    await db.runAsync('DELETE FROM task_history WHERE task_id = ?', [id]);
    await db.runAsync('DELETE FROM task_subtasks WHERE task_id = ?', [id]);
    
    // Now delete the task
    await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// POST /api/tasks/:id/subtasks - Add subtask
router.post('/:id/subtasks', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Subtask title required' });
    }

    // Get current task
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get max order_index
    const maxOrder = await db.getAsync(
      'SELECT MAX(order_index) as max_order FROM task_subtasks WHERE task_id = ?',
      [id]
    );
    const nextOrder = (maxOrder?.max_order ?? -1) + 1;

    const result = await db.runAsync(
      'INSERT INTO task_subtasks (task_id, title, order_index) VALUES (?, ?, ?)',
      [id, toTitleCase(sanitizeInput(title)), nextOrder]
    );

    const newSubtask = await db.getAsync(`
      SELECT ts.*, u.full_name as completed_by_name
      FROM task_subtasks ts
      LEFT JOIN users u ON ts.completed_by = u.id
      WHERE ts.id = ?
    `, [result.lastID]);

    res.status(201).json({ subtask: newSubtask });
  } catch (error) {
    console.error('Add subtask error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id/subtasks/:subtaskId - Update subtask (toggle completion)
router.put('/:id/subtasks/:subtaskId', async (req, res) => {
  try {
    const { id, subtaskId } = req.params;
    const { is_completed } = req.body;

    // Get current task
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Employees can only update checklist items on tasks they are associated with
    // (assigned via legacy assigned_to, new task_assignments, or created_by)
    if (req.user.role !== 'admin') {
      let isAssigned = task.assigned_to === req.user.id || task.created_by === req.user.id;
      if (!isAssigned) {
        try {
          const assignments = await db.allAsync(
            'SELECT user_id FROM task_assignments WHERE task_id = ?',
            [id]
          );
          isAssigned = (assignments || []).some(a => a.user_id === req.user.id);
        } catch (_) {
          // If assignments table doesn't exist, fall back to legacy check above
        }
      }

      if (!isAssigned) {
        return res.status(403).json({ error: 'You can only update tasks assigned to you' });
      }
    }

    const completed = is_completed ? 1 : 0;
    const completedAt = is_completed ? new Date().toISOString() : null;
    const completedBy = is_completed ? req.user.id : null;

    await db.runAsync(
      'UPDATE task_subtasks SET is_completed = ?, completed_at = ?, completed_by = ? WHERE id = ? AND task_id = ?',
      [completed, completedAt, completedBy, subtaskId, id]
    );

    const updatedSubtask = await db.getAsync(`
      SELECT ts.*, u.full_name as completed_by_name
      FROM task_subtasks ts
      LEFT JOIN users u ON ts.completed_by = u.id
      WHERE ts.id = ? AND ts.task_id = ?
    `, [subtaskId, id]);

    res.json({ subtask: updatedSubtask });
  } catch (error) {
    console.error('Update subtask error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:id/subtasks/:subtaskId - Delete subtask
router.delete('/:id/subtasks/:subtaskId', requireAdmin, async (req, res) => {
  try {
    const { id, subtaskId } = req.params;
    await db.runAsync('DELETE FROM task_subtasks WHERE id = ? AND task_id = ?', [subtaskId, id]);
    res.json({ message: 'Subtask deleted successfully' });
  } catch (error) {
    console.error('Delete subtask error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---- Task inventory (parts & materials) ----

// POST /api/tasks/:id/inventory - Link an inventory item to this task
router.post('/:id/inventory', async (req, res) => {
  try {
    const { id } = req.params;
    const { item_id: itemIdRaw, quantity_used: quantityUsedRaw } = req.body || {};
    const itemId = itemIdRaw != null ? Number(itemIdRaw) : null;
    if (!itemId || !Number.isFinite(itemId)) {
      return res.status(400).json({ error: 'item_id is required' });
    }
    const task = await db.getAsync('SELECT id FROM tasks WHERE id = ?', [id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const item = await db.getAsync('SELECT id, name, unit FROM inventory_items WHERE id = ?', [itemId]);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    const quantityUsed = quantityUsedRaw !== undefined && quantityUsedRaw !== null && quantityUsedRaw !== ''
      ? Number.parseFloat(quantityUsedRaw)
      : null;
    if (quantityUsed !== null && (!Number.isFinite(quantityUsed) || quantityUsed < 0)) {
      return res.status(400).json({ error: 'quantity_used must be a non-negative number' });
    }
    await db.runAsync(
      `INSERT INTO task_inventory_usage (task_id, item_id, quantity_used, created_by) VALUES (?, ?, ?, ?)`,
      [id, itemId, quantityUsed, req.user.id]
    );
    const row = await db.getAsync(
      `SELECT u.id, u.task_id, u.item_id, u.quantity_used, u.created_at,
              i.name AS item_name, i.unit AS item_unit, c.name AS category_name
       FROM task_inventory_usage u
       JOIN inventory_items i ON i.id = u.item_id
       LEFT JOIN inventory_categories c ON c.id = i.category_id
       WHERE u.task_id = ? AND u.item_id = ?
       ORDER BY u.created_at DESC LIMIT 1`,
      [id, itemId]
    );
    res.status(201).json({ usage: row });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'This item is already linked to the task' });
    }
    console.error('Add task inventory error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/tasks/:id/inventory/:usageId - Update quantity used
router.patch('/:id/inventory/:usageId', async (req, res) => {
  try {
    const { id, usageId } = req.params;
    const { quantity_used: quantityUsedRaw } = req.body || {};
    const quantityUsed = quantityUsedRaw === undefined || quantityUsedRaw === null || quantityUsedRaw === ''
      ? null
      : Number.parseFloat(quantityUsedRaw);
    if (quantityUsed !== null && (!Number.isFinite(quantityUsed) || quantityUsed < 0)) {
      return res.status(400).json({ error: 'quantity_used must be a non-negative number' });
    }
    const existing = await db.getAsync(
      'SELECT id FROM task_inventory_usage WHERE id = ? AND task_id = ?',
      [usageId, id]
    );
    if (!existing) return res.status(404).json({ error: 'Usage record not found' });
    await db.runAsync(
      'UPDATE task_inventory_usage SET quantity_used = ? WHERE id = ? AND task_id = ?',
      [quantityUsed, usageId, id]
    );
    const row = await db.getAsync(
      `SELECT u.id, u.task_id, u.item_id, u.quantity_used, u.created_at,
              i.name AS item_name, i.unit AS item_unit, c.name AS category_name
       FROM task_inventory_usage u
       JOIN inventory_items i ON i.id = u.item_id
       LEFT JOIN inventory_categories c ON c.id = i.category_id
       WHERE u.id = ? AND u.task_id = ?`,
      [usageId, id]
    );
    res.json({ usage: row });
  } catch (error) {
    console.error('Update task inventory error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:id/inventory/:usageId - Unlink item from task
router.delete('/:id/inventory/:usageId', async (req, res) => {
  try {
    const { id, usageId } = req.params;
    const result = await db.runAsync(
      'DELETE FROM task_inventory_usage WHERE id = ? AND task_id = ?',
      [usageId, id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Usage record not found' });
    res.json({ message: 'Removed from task' });
  } catch (error) {
    console.error('Delete task inventory error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/:id/submit-for-review - Submit task for admin review
router.post('/:id/submit-for-review', async (req, res) => {
  try {
    const { id } = req.params;
    const { torqued_to_spec } = req.body;

    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Only employees associated with the task can submit
    // (assigned via legacy assigned_to, new task_assignments, or created_by)
    if (req.user.role !== 'admin') {
      let isAssigned = task.assigned_to === req.user.id || task.created_by === req.user.id;
      if (!isAssigned) {
        try {
          const assignments = await db.allAsync(
            'SELECT user_id FROM task_assignments WHERE task_id = ?',
            [id]
          );
          isAssigned = (assignments || []).some(a => a.user_id === req.user.id);
        } catch (_) {
          // If assignments table doesn't exist, fall back to legacy check above
        }
      }

      if (!isAssigned) {
        return res.status(403).json({ error: 'You can only submit tasks assigned to you' });
      }
    }

    // Check if all subtasks are completed
    const subtasks = await db.allAsync('SELECT * FROM task_subtasks WHERE task_id = ?', [id]);
    const allCompleted = subtasks.length > 0 && subtasks.every(st => st.is_completed === 1);

    if (!allCompleted && subtasks.length > 0) {
      return res.status(400).json({ error: 'All subtasks must be completed before submitting for review' });
    }

    // Update task status to review
    await db.runAsync(
      `UPDATE tasks 
       SET status = 'review', 
           torqued_to_spec = ?,
           submitted_for_review_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [torqued_to_spec ? 1 : 0, id]
    );

    // Log history
    await db.runAsync(
      'INSERT INTO task_history (task_id, changed_by, field_changed, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, 'status', task.status, 'review']
    );

    const updatedTask = await db.getAsync(`
      SELECT t.*, 
             u1.full_name as assigned_to_name,
             u2.full_name as created_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.id = ?
    `, [id]);

    // Add time tracking data
    await addTimeTrackingToTask(updatedTask, db);

    res.json({ task: updatedTask, message: 'Task submitted for admin review' });
  } catch (error) {
    console.error('Submit for review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/:id/approve - Admin approve task (moves to completed/archived)
router.post('/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { archive } = req.body; // If true, archive immediately; if false, just mark as completed

    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Set completed_at if not already set
    const updateFields = [
      "status = 'completed'",
      'admin_approved = 1',
      `is_archived = ${archive ? 1 : 0}`,
      'updated_at = CURRENT_TIMESTAMP'
    ];
    
    if (!task.completed_at) {
      updateFields.push('completed_at = ?');
      updateFields.push('completed_by = ?');
    }
    
    const updateParams = [];
    if (!task.completed_at) {
      updateParams.push(new Date().toISOString());
      updateParams.push(req.user.id);
    }
    updateParams.push(id);
    
    await db.runAsync(
      `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    // Sync to ShopMonkey if task has a ShopMonkey order ID
    if (task.shopmonkey_order_id) {
      try {
        const syncResult = await syncTaskCompletionToShopMonkey(task.shopmonkey_order_id, {
          note: `Task "${task.title}" approved and completed in Spectrum Outfitters Calendar`
        });
        console.log('ShopMonkey sync successful:', syncResult);
      } catch (syncError) {
        // Don't fail the request if ShopMonkey sync fails, just log it
        console.error('ShopMonkey sync failed (non-blocking):', syncError.message);
      }
    }

    // Log history
    await db.runAsync(
      'INSERT INTO task_history (task_id, changed_by, field_changed, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, 'admin_approved', '0', '1']
    );

    // Decrement inventory for parts/materials used on this task (only when task is approved)
    const usages = await db.allAsync(
      'SELECT item_id, quantity_used FROM task_inventory_usage WHERE task_id = ?',
      [id]
    );
    for (const u of usages) {
      const deduct = (u.quantity_used != null && Number(u.quantity_used) > 0)
        ? Number(u.quantity_used)
        : 1;
      const item = await db.getAsync('SELECT id, quantity FROM inventory_items WHERE id = ?', [u.item_id]);
      if (!item) continue;
      const before = item.quantity ?? 0;
      const after = Math.max(0, before - deduct);
      await db.runAsync(
        `UPDATE inventory_items SET quantity = ?, last_counted_at = CURRENT_TIMESTAMP, last_counted_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [after, req.user.id, u.item_id]
      );
      await db.runAsync(
        `INSERT INTO inventory_quantity_log (item_id, quantity_before, quantity_after, changed_by, reason) VALUES (?, ?, ?, ?, 'task_approved')`,
        [u.item_id, before, after, req.user.id]
      ).catch(() => {});
    }

    const updatedTask = await db.getAsync(`
      SELECT t.*, 
             u1.full_name as assigned_to_name,
             u2.full_name as created_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.id = ?
    `, [id]);

    // Add time tracking data
    await addTimeTrackingToTask(updatedTask, db);

    res.json({ task: updatedTask, message: archive ? 'Task approved and archived' : 'Task approved' });
  } catch (error) {
    console.error('Approve task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/:id/archive - Archive task
router.post('/:id/archive', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('UPDATE tasks SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    
    const updatedTask = await db.getAsync(`
      SELECT t.*, 
             u1.full_name as assigned_to_name,
             u2.full_name as created_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.id = ?
    `, [id]);

    // Add time tracking data
    await addTimeTrackingToTask(updatedTask, db);

    res.json({ task: updatedTask, message: 'Task archived' });
  } catch (error) {
    console.error('Archive task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/:id/comments - Add comment
router.post('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: 'Comment required' });
    }

    const result = await db.runAsync(
      'INSERT INTO task_comments (task_id, user_id, comment) VALUES (?, ?, ?)',
      [id, req.user.id, sanitizeInput(comment)]
    );

    const newComment = await db.getAsync(`
      SELECT tc.*, u.full_name as user_name, u.username
      FROM task_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      WHERE tc.id = ?
    `, [result.lastID]);

    res.status(201).json({ comment: newComment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/:id/history - Get task history
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const history = await db.allAsync(`
      SELECT th.*, u.full_name as changed_by_name
      FROM task_history th
      LEFT JOIN users u ON th.changed_by = u.id
      WHERE th.task_id = ?
      ORDER BY th.changed_at DESC
    `, [id]);
    res.json({ history });
  } catch (error) {
    console.error('Get task history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/:id/break/start - Start a pause on a task
router.post('/:id/break/start', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;
    
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Pause reason is required' });
    }
    
    // Get current task
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Employees can only start pauses on tasks they are associated with
    // (assigned via legacy assigned_to, new task_assignments, or created_by)
    if (req.user.role !== 'admin') {
      let isAssigned = task.assigned_to === req.user.id || task.created_by === req.user.id;
      if (!isAssigned) {
        try {
          const assignments = await db.allAsync(
            'SELECT user_id FROM task_assignments WHERE task_id = ?',
            [id]
          );
          isAssigned = (assignments || []).some(a => a.user_id === req.user.id);
        } catch (_) {
          // If assignments table doesn't exist, fall back to legacy check above
        }
      }

      if (!isAssigned) {
        return res.status(403).json({ error: 'You can only pause tasks assigned to you' });
      }
    }

    // Check if task is started
    if (!task.started_at) {
      return res.status(400).json({ error: 'Task must be started before pausing' });
    }

    // Check if there's already an active pause (break_end is NULL)
    const activeBreak = await db.getAsync(
      'SELECT * FROM task_breaks WHERE task_id = ? AND user_id = ? AND break_end IS NULL',
      [id, req.user.id]
    );

    if (activeBreak) {
      return res.status(400).json({ error: 'You already have an active pause on this task' });
    }

    // Start the pause
    const result = await db.runAsync(
      'INSERT INTO task_breaks (task_id, user_id, break_start, reason, notes) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, new Date().toISOString(), reason.trim(), notes?.trim() || null]
    );

    const breakRecord = await db.getAsync('SELECT * FROM task_breaks WHERE id = ?', [result.lastID]);

    res.json({ break: breakRecord, message: 'Pause started successfully' });
  } catch (error) {
    console.error('Start pause error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/:id/break/end - End a pause on a task
router.post('/:id/break/end', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get current task
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Employees can only end pauses on tasks they are associated with
    // (assigned via legacy assigned_to, new task_assignments, or created_by)
    if (req.user.role !== 'admin') {
      let isAssigned = task.assigned_to === req.user.id || task.created_by === req.user.id;
      if (!isAssigned) {
        try {
          const assignments = await db.allAsync(
            'SELECT user_id FROM task_assignments WHERE task_id = ?',
            [id]
          );
          isAssigned = (assignments || []).some(a => a.user_id === req.user.id);
        } catch (_) {
          // If assignments table doesn't exist, fall back to legacy check above
        }
      }

      if (!isAssigned) {
        return res.status(403).json({ error: 'You can only resume tasks assigned to you' });
      }
    }

    // Find active pause
    const activeBreak = await db.getAsync(
      'SELECT * FROM task_breaks WHERE task_id = ? AND user_id = ? AND break_end IS NULL',
      [id, req.user.id]
    );

    if (!activeBreak) {
      return res.status(400).json({ error: 'No active pause found for this task' });
    }

    // End the pause
    await db.runAsync(
      'UPDATE task_breaks SET break_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [new Date().toISOString(), activeBreak.id]
    );

    const breakRecord = await db.getAsync('SELECT * FROM task_breaks WHERE id = ?', [activeBreak.id]);

    res.json({ break: breakRecord, message: 'Pause ended successfully' });
  } catch (error) {
    console.error('End pause error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/:id/breaks - Get all breaks for a task
router.get('/:id/breaks', async (req, res) => {
  try {
    const { id } = req.params;
    
    const breaks = await db.allAsync(`
      SELECT tb.*, u.full_name as user_name
      FROM task_breaks tb
      LEFT JOIN users u ON tb.user_id = u.id
      WHERE tb.task_id = ?
      ORDER BY tb.break_start DESC
    `, [id]);

    res.json({ breaks });
  } catch (error) {
    console.error('Get breaks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/:id/time-tracking - Get detailed time tracking data for a task
router.get('/:id/time-tracking', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get task with all related data
    const task = await db.getAsync(`
      SELECT t.*, 
             u1.full_name as assigned_to_name,
             u2.full_name as created_by_name,
             u3.full_name as started_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      LEFT JOIN users u3 ON t.started_by = u3.id
      WHERE t.id = ?
    `, [id]);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Get breaks
    let breaks = [];
    try {
      breaks = await db.allAsync(`
        SELECT tb.*, u.full_name as user_name
        FROM task_breaks tb
        LEFT JOIN users u ON tb.user_id = u.id
        WHERE tb.task_id = ?
        ORDER BY tb.break_start ASC
      `, [id]) || [];
    } catch (breakError) {
      console.warn('Error fetching task breaks:', breakError.message);
    }
    
    task.breaks = breaks;
    task.active_break = breaks.find(b => !b.break_end) || null;
    
    // Calculate time tracking
    const workingTime = calculateTaskWorkingTime(task);
    const totalDuration = calculateTaskTotalDuration(task);
    const currentElapsed = getCurrentElapsedTime(task);
    
    // Calculate break details
    const breakDetails = breaks.map(breakItem => {
      if (!breakItem.break_start) return null;
      
      const breakStart = new Date(breakItem.break_start);
      const breakEnd = breakItem.break_end ? new Date(breakItem.break_end) : new Date();
      const breakMs = breakEnd - breakStart;
      const breakMinutes = Math.floor(breakMs / (1000 * 60));
      
      return {
        id: breakItem.id,
        reason: breakItem.reason,
        notes: breakItem.notes,
        startTime: breakItem.break_start,
        endTime: breakItem.break_end,
        durationMinutes: breakMinutes,
        durationFormatted: formatDuration(breakMinutes),
        isActive: !breakItem.break_end,
        user: breakItem.user_name
      };
    }).filter(b => b !== null);
    
    res.json({
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        started_at: task.started_at,
        completed_at: task.completed_at,
        started_by: task.started_by_name
      },
      workingTime,
      totalDuration,
      currentElapsed,
      breaks: breakDetails,
      activeBreak: task.active_break ? {
        ...task.active_break,
        durationMinutes: Math.floor((new Date() - new Date(task.active_break.break_start)) / (1000 * 60))
      } : null,
      summary: {
        totalWorkingMinutes: workingTime.totalMinutes,
        totalWorkingHours: workingTime.totalHours,
        totalBreakMinutes: breakDetails.reduce((sum, b) => sum + (b.durationMinutes || 0), 0),
        breakCount: breakDetails.length,
        isActive: !task.completed_at && task.started_at,
        estimatedMinutes: task.estimated_time_minutes,
        varianceMinutes: task.estimated_time_minutes 
          ? workingTime.totalMinutes - task.estimated_time_minutes 
          : null
      }
    });
  } catch (error) {
    console.error('Get time tracking error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function for formatting duration (imported from utils)
function formatDuration(minutes) {
  if (!minutes || minutes < 0) return '0 minutes';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} minute${mins !== 1 ? 's' : ''}`;
  if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
}

// POST /api/tasks/estimate-time - AI-powered time estimation
router.post('/estimate-time', requireAdmin, async (req, res) => {
  try {
    if (!(await isAIEnabled())) {
      return res.status(400).json({ error: 'AI is not enabled. Configure Claude API key or set up local Ollama.' });
    }

    const { title, description, category, subtasks } = req.body;

    if (!title && !description) {
      return res.status(400).json({ error: 'Title or description is required' });
    }

    // Get historical similar tasks for learning
    let historicalTasks = [];
    try {
      const similarQuery = category
        ? `SELECT title, description, category, estimated_time_minutes, 
           (julianday(completed_at) - julianday(started_at)) * 24 * 60 as actual_minutes
           FROM tasks 
           WHERE category = ? AND completed_at IS NOT NULL AND started_at IS NOT NULL
           ORDER BY created_at DESC LIMIT 10`
        : `SELECT title, description, category, estimated_time_minutes,
           (julianday(completed_at) - julianday(started_at)) * 24 * 60 as actual_minutes
           FROM tasks 
           WHERE completed_at IS NOT NULL AND started_at IS NOT NULL
           ORDER BY created_at DESC LIMIT 10`;
      
      historicalTasks = await db.allAsync(similarQuery, category ? [category] : []);
    } catch (histError) {
      console.warn('Could not fetch historical tasks:', histError);
    }

    const taskData = {
      title,
      description,
      category,
      subtasks: subtasks || []
    };

    const estimate = await estimateTaskTime(taskData, historicalTasks);

    if (!estimate) {
      return res.status(500).json({ error: 'Failed to generate time estimate' });
    }

    res.json({
      estimatedMinutes: estimate.estimatedMinutes,
      confidence: estimate.confidence,
      reasoning: estimate.reasoning
    });
  } catch (error) {
    console.error('Time estimation error:', error);
    res.status(500).json({ error: error.message || 'Failed to estimate time' });
  }
});

// POST /api/tasks/:id/suggest-assignment - AI-powered assignment suggestion
router.post('/:id/suggest-assignment', requireAdmin, async (req, res) => {
  try {
    if (!(await isAIEnabled())) {
      return res.status(400).json({ error: 'AI is not enabled. Configure Claude API key or set up local Ollama.' });
    }

    const { id } = req.params;
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get all active employees
    const employees = await db.allAsync(`
      SELECT u.id, u.full_name, u.role,
      (SELECT COUNT(*) FROM tasks t 
       WHERE (t.assigned_to = u.id OR EXISTS (
         SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.user_id = u.id
       )) AND t.status NOT IN ('completed', 'archived')) as currentTasks
      FROM users u
      WHERE u.is_active = 1 AND u.role = 'employee'
    `);

    // Get task subtasks
    const subtasks = await db.allAsync(
      'SELECT title FROM task_subtasks WHERE task_id = ?',
      [id]
    );

    const taskData = {
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      subtasks: subtasks.map(s => s.title)
    };

    const suggestion = await suggestTaskAssignment(taskData, employees);

    if (!suggestion) {
      return res.status(500).json({ error: 'Failed to generate assignment suggestion' });
    }

    res.json(suggestion);
  } catch (error) {
    console.error('Assignment suggestion error:', error);
    res.status(500).json({ error: error.message || 'Failed to suggest assignment' });
  }
});

// POST /api/tasks/categorize - AI-powered categorization
router.post('/categorize', requireAdmin, async (req, res) => {
  try {
    if (!(await isAIEnabled())) {
      return res.status(400).json({ error: 'AI is not enabled. Configure Claude API key or set up local Ollama.' });
    }

    const { title, description } = req.body;

    if (!title && !description) {
      return res.status(400).json({ error: 'Title or description is required' });
    }

    const result = await categorizeTask(title || '', description || '');

    if (!result) {
      return res.status(500).json({ error: 'Failed to categorize task' });
    }

    res.json({
      category: result.category,
      confidence: result.confidence,
      reasoning: result.reasoning
    });
  } catch (error) {
    console.error('Categorization error:', error);
    res.status(500).json({ error: error.message || 'Failed to categorize task' });
  }
});

// GET /api/tasks/:id/quality-checks - AI-powered quality check suggestions
// DISABLED by default due to performance issues (100% CPU usage with local AI)
router.get('/:id/quality-checks', async (req, res) => {
  try {
    // Disable AI quality checks by default - requires explicit opt-in
    if (process.env.ENABLE_AI_QUALITY_CHECKS !== 'true') {
      return res.status(400).json({ 
        error: 'AI quality checks are disabled by default due to performance issues.',
        message: 'To enable, add ENABLE_AI_QUALITY_CHECKS=true to backend/.env'
      });
    }
    
    if (!(await isAIEnabled())) {
      return res.status(400).json({ error: 'AI is not enabled. Configure Claude API key or set up local Ollama.' });
    }

    const { id } = req.params;
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get similar completed tasks
    let similarTasks = [];
    try {
      similarTasks = await db.allAsync(`
        SELECT t.title, t.description, t.category, tc.comment
        FROM tasks t
        LEFT JOIN task_comments tc ON t.id = tc.task_id
        WHERE t.category = ? AND t.status = 'completed' AND t.id != ?
        ORDER BY t.created_at DESC
        LIMIT 5
      `, [task.category, id]);
    } catch (simError) {
      console.warn('Could not fetch similar tasks:', simError);
    }

    // Get task subtasks
    const subtasks = await db.allAsync(
      'SELECT title FROM task_subtasks WHERE task_id = ?',
      [id]
    );

    const taskData = {
      title: task.title,
      description: task.description,
      category: task.category,
      subtasks: subtasks.map(s => s.title)
    };

    const checks = await generateQualityChecks(taskData, similarTasks);

    if (!checks || !Array.isArray(checks)) {
      return res.status(500).json({ error: 'Failed to generate quality checks' });
    }

    res.json({ checks });
  } catch (error) {
    console.error('Quality checks error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate quality checks' });
  }
});

// GET /api/tasks/:id/recommendations - AI-powered parts and labor recommendations
// DISABLED by default due to performance issues (100% CPU usage with local AI)
router.get('/:id/recommendations', async (req, res) => {
  try {
    // Disable AI recommendations by default - requires explicit opt-in
    if (process.env.ENABLE_AI_RECOMMENDATIONS !== 'true') {
      return res.status(400).json({ 
        error: 'AI recommendations are disabled by default due to performance issues.',
        message: 'To enable, add ENABLE_AI_RECOMMENDATIONS=true to backend/.env'
      });
    }
    
    if (!(await isAIEnabled())) {
      return res.status(400).json({ error: 'AI is not enabled. Configure Claude API key or set up local Ollama.' });
    }

    const { id } = req.params;
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get task subtasks
    const subtasks = await db.allAsync(
      'SELECT title FROM task_subtasks WHERE task_id = ?',
      [id]
    );

    const taskData = {
      title: task.title,
      description: task.description,
      category: task.category,
      subtasks: subtasks.map(s => s.title)
    };

    const recommendations = await generateRecommendations(taskData);

    if (!recommendations) {
      return res.status(500).json({ error: 'Failed to generate recommendations' });
    }

    res.json(recommendations);
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate recommendations' });
  }
});

export default router;
