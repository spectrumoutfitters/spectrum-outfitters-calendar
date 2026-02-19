import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Helper to get today's date in America/Chicago timezone
function getTodayInCentral() {
  const now = new Date();
  const centralTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  return centralTime; // Returns YYYY-MM-DD format
}

// Helper to get day of week (0=Sunday, 1=Monday, etc.)
function getDayOfWeek() {
  const now = new Date();
  const options = { timeZone: 'America/Chicago', weekday: 'short' };
  const dayStr = new Intl.DateTimeFormat('en-US', options).format(now);
  const days = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  return days[dayStr];
}

// Helper to get day of month
function getDayOfMonth() {
  const now = new Date();
  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    day: 'numeric'
  }).format(now);
  return parseInt(dayStr, 10);
}

// Generate smart items based on system data
async function generateSmartItems(today) {
  const smartItems = [];

  // 1. Pending time off requests
  try {
    const pendingRequests = await db.allAsync(`
      SELECT se.id, u.full_name, se.start_date, se.end_date
      FROM schedule_entries se
      JOIN users u ON se.user_id = u.id
      WHERE se.status = 'pending' AND se.type = 'time_off_request'
      ORDER BY se.start_date ASC
      LIMIT 5
    `);
    if (pendingRequests && pendingRequests.length > 0) {
      const names = pendingRequests.map(r => r.full_name).join(', ');
      const metadata = JSON.stringify({ request_ids: pendingRequests.map(r => r.id) });
      smartItems.push({
        smart_key: 'pending_time_off',
        title: `Approve time off requests (${pendingRequests.length})`,
        description: `Pending requests from: ${names}`,
        smart_count: pendingRequests.length,
        link_target: '/admin?tab=time',
        sort_order: 100,
        priority: 'high',
        category: 'time_approval',
        metadata
      });
    }
  } catch (error) {
    console.error('Error checking pending time off:', error);
  }

  // 2. Tasks awaiting review
  try {
    const tasksInReview = await db.allAsync(`
      SELECT t.id, t.title, u.full_name as submitted_by
      FROM tasks t
      LEFT JOIN users u ON t.completed_by = u.id
      WHERE t.status = 'review' AND (t.is_archived = 0 OR t.is_archived IS NULL)
      ORDER BY t.submitted_for_review_at DESC
      LIMIT 5
    `);
    if (tasksInReview && tasksInReview.length > 0) {
      const taskTitles = tasksInReview.slice(0, 2).map(t => `"${t.title}"`).join(', ');
      const moreText = tasksInReview.length > 2 ? ` +${tasksInReview.length - 2} more` : '';
      const metadata = JSON.stringify({ task_ids: tasksInReview.map(t => t.id) });
      smartItems.push({
        smart_key: 'tasks_in_review',
        title: `Review submitted tasks (${tasksInReview.length})`,
        description: `Tasks waiting for approval: ${taskTitles}${moreText}`,
        smart_count: tasksInReview.length,
        link_target: '/tasks?status=review',
        sort_order: 101,
        priority: 'high',
        category: 'task_review',
        metadata
      });
    }
  } catch (error) {
    console.error('Error checking tasks in review:', error);
  }

  // 3. Unapproved time entries
  try {
    const unapprovedEntries = await db.allAsync(`
      SELECT te.id, u.full_name, DATE(te.clock_in) as work_date
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.clock_out IS NOT NULL AND te.approved_by IS NULL
      ORDER BY te.clock_in DESC
      LIMIT 5
    `);
    const totalCount = await db.getAsync(`
      SELECT COUNT(*) as count FROM time_entries
      WHERE clock_out IS NOT NULL AND approved_by IS NULL
    `);
    
    if (totalCount && totalCount.count > 0) {
      const names = [...new Set(unapprovedEntries.map(e => e.full_name))];
      const nameList = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3} more` : '');
      const metadata = JSON.stringify({ entry_ids: unapprovedEntries.map(e => e.id) });
      smartItems.push({
        smart_key: 'unapproved_time_entries',
        title: `Approve time clock entries (${totalCount.count})`,
        description: `${totalCount.count} completed shift(s) need approval: ${nameList}`,
        smart_count: totalCount.count,
        link_target: '/time',
        sort_order: 102,
        priority: 'high',
        category: 'time_approval',
        metadata
      });
    }
  } catch (error) {
    console.error('Error checking unapproved time entries:', error);
  }

  // 4. Overdue tasks
  try {
    const overdueTasks = await db.allAsync(`
      SELECT t.id, t.title, t.due_date, u.full_name as assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.due_date IS NOT NULL 
        AND DATE(t.due_date) < DATE(?)
        AND t.status NOT IN ('completed', 'archived')
        AND (t.is_archived = 0 OR t.is_archived IS NULL)
      ORDER BY t.due_date ASC
      LIMIT 10
    `, [today]);
    if (overdueTasks && overdueTasks.length > 0) {
      const taskTitles = overdueTasks.slice(0, 2).map(t => `"${t.title}"`).join(', ');
      const moreText = overdueTasks.length > 2 ? ` +${overdueTasks.length - 2} more` : '';
      const metadata = JSON.stringify({ task_ids: overdueTasks.map(t => t.id) });
      smartItems.push({
        smart_key: 'overdue_tasks',
        title: `Overdue tasks (${overdueTasks.length})`,
        description: `Tasks past due date: ${taskTitles}${moreText}`,
        smart_count: overdueTasks.length,
        link_target: '/tasks?status=overdue',
        sort_order: 90,
        priority: 'urgent',
        category: 'task_review',
        metadata
      });
    }
  } catch (error) {
    console.error('Error checking overdue tasks:', error);
  }

  // 5. Compliance deadlines
  try {
    const complianceDeadlines = await db.allAsync(`
      SELECT ci.id, ci.due_date, ci.status, co.name as obligation_name, ci.period_label
      FROM compliance_instances ci
      JOIN compliance_obligations co ON ci.obligation_id = co.id
      WHERE co.enabled = 1
        AND ci.status IN ('overdue', 'due_soon')
      ORDER BY 
        CASE ci.status WHEN 'overdue' THEN 0 ELSE 1 END,
        ci.due_date ASC
      LIMIT 10
    `);
    if (complianceDeadlines && complianceDeadlines.length > 0) {
      const overdue = complianceDeadlines.filter(c => c.status === 'overdue');
      const dueSoon = complianceDeadlines.filter(c => c.status === 'due_soon');
      let description = '';
      if (overdue.length > 0) {
        description += `${overdue.length} overdue: ${overdue[0].obligation_name}`;
        if (overdue.length > 1) description += ` +${overdue.length - 1} more`;
      }
      if (dueSoon.length > 0) {
        if (description) description += '; ';
        description += `${dueSoon.length} due soon: ${dueSoon[0].obligation_name}`;
        if (dueSoon.length > 1) description += ` +${dueSoon.length - 1} more`;
      }
      const metadata = JSON.stringify({ instance_ids: complianceDeadlines.map(c => c.id) });
      smartItems.push({
        smart_key: 'compliance_deadlines',
        title: `Compliance deadlines (${complianceDeadlines.length})`,
        description,
        smart_count: complianceDeadlines.length,
        link_target: '/admin?tab=compliance',
        sort_order: 95,
        priority: overdue.length > 0 ? 'urgent' : 'high',
        category: 'compliance',
        metadata
      });
    }
  } catch (error) {
    console.error('Error checking compliance deadlines:', error);
  }

  // 6. Unread admin messages
  try {
    const unreadMessages = await db.allAsync(`
      SELECT m.id, m.message, m.created_at, u.full_name as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.is_team_message = 1 
        AND m.board_type = 'admin_board'
        AND NOT EXISTS (
          SELECT 1 FROM message_reads mr 
          WHERE mr.message_id = m.id AND mr.user_id = ?
        )
      ORDER BY m.created_at DESC
      LIMIT 10
    `, [1]); // Assuming admin user ID is 1, or we could pass it as parameter
    if (unreadMessages && unreadMessages.length > 0) {
      const senders = [...new Set(unreadMessages.map(m => m.sender_name))];
      const senderList = senders.slice(0, 2).join(', ') + (senders.length > 2 ? ` +${senders.length - 2} more` : '');
      const metadata = JSON.stringify({ message_ids: unreadMessages.map(m => m.id) });
      smartItems.push({
        smart_key: 'unread_admin_messages',
        title: `Unread admin messages (${unreadMessages.length})`,
        description: `Messages from: ${senderList}`,
        smart_count: unreadMessages.length,
        link_target: '/admin?tab=messages',
        sort_order: 103,
        priority: 'medium',
        category: 'general',
        metadata
      });
    }
  } catch (error) {
    console.error('Error checking unread messages:', error);
  }

  // 6b. Pending inventory refill requests
  try {
    const pendingRefills = await db.allAsync(`
      SELECT r.id, r.requested_at, i.name AS item_name, u.full_name AS requested_by_name
      FROM inventory_refill_requests r
      JOIN inventory_items i ON i.id = r.item_id
      JOIN users u ON u.id = r.requested_by
      WHERE r.status = 'pending'
      ORDER BY r.requested_at DESC
      LIMIT 10
    `);
    if (pendingRefills && pendingRefills.length > 0) {
      const itemNames = pendingRefills.slice(0, 2).map(r => r.item_name).join(', ');
      const more = pendingRefills.length > 2 ? ` +${pendingRefills.length - 2} more` : '';
      const metadata = JSON.stringify({ request_ids: pendingRefills.map(r => r.id) });
      smartItems.push({
        smart_key: 'inventory_refill_requests',
        title: `Reorder requests (${pendingRefills.length})`,
        description: `Fill out where ordered, price & when it will arrive: ${itemNames}${more}`,
        smart_count: pendingRefills.length,
        link_target: '/admin?tab=inventory&refills=1',
        sort_order: 102,
        priority: 'high',
        category: 'inventory',
        metadata
      });
    }
  } catch (error) {
    // Table may not exist yet
  }

  // 7. Pending orders
  try {
    const pendingOrders = await db.allAsync(`
      SELECT o.id, o.total_amount, u.full_name as customer_name, o.created_at
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.status = 'pending'
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    if (pendingOrders && pendingOrders.length > 0) {
      const customers = [...new Set(pendingOrders.map(o => o.customer_name))];
      const customerList = customers.slice(0, 2).join(', ') + (customers.length > 2 ? ` +${customers.length - 2} more` : '');
      const totalAmount = pendingOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
      const metadata = JSON.stringify({ order_ids: pendingOrders.map(o => o.id) });
      smartItems.push({
        smart_key: 'pending_orders',
        title: `Pending orders (${pendingOrders.length})`,
        description: `$${totalAmount.toFixed(2)} from: ${customerList}`,
        smart_count: pendingOrders.length,
        link_target: '/admin?tab=orders',
        sort_order: 104,
        priority: 'medium',
        category: 'inventory',
        metadata
      });
    }
  } catch (error) {
    console.error('Error checking pending orders:', error);
  }

  // 8. Employee issues (late clock-ins)
  try {
    const todayStart = new Date(today + 'T00:00:00');
    const todayEnd = new Date(today + 'T23:59:59');
    const lateClockIns = await db.allAsync(`
      SELECT u.id, u.full_name, COUNT(*) as late_count
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE DATE(te.clock_in) = DATE(?)
        AND TIME(te.clock_in) > '09:00:00'
        AND u.is_active = 1
      GROUP BY u.id, u.full_name
      HAVING late_count >= 2
      ORDER BY late_count DESC
      LIMIT 5
    `, [today]);
    if (lateClockIns && lateClockIns.length > 0) {
      const names = lateClockIns.map(e => `${e.full_name} (${e.late_count}x)`).join(', ');
      const metadata = JSON.stringify({ user_ids: lateClockIns.map(e => e.id) });
      smartItems.push({
        smart_key: 'employee_late_clockins',
        title: `Employee late clock-ins (${lateClockIns.length})`,
        description: `Multiple late arrivals: ${names}`,
        smart_count: lateClockIns.length,
        link_target: '/admin?tab=time',
        sort_order: 105,
        priority: 'medium',
        category: 'general',
        metadata
      });
    }
  } catch (error) {
    console.error('Error checking employee late clock-ins:', error);
  }

  // 9. Weekly P&L review reminder (Fridays)
  try {
    const dayOfWeek = getDayOfWeek();
    if (dayOfWeek === 5) { // Friday
      const lastFriday = new Date(today);
      lastFriday.setDate(lastFriday.getDate() - 7);
      const lastFridayStr = lastFriday.toISOString().split('T')[0];
      
      // Check if P&L was reviewed last week (placeholder - would need a tracking table)
      smartItems.push({
        smart_key: 'weekly_pnl_review',
        title: 'Review weekly P&L',
        description: 'Review profit & loss for the week ending today',
        smart_count: 1,
        link_target: '/admin?tab=compliance&subtab=pnl',
        sort_order: 50,
        priority: 'high',
        category: 'compliance',
        metadata: JSON.stringify({ week_ending: today })
      });
    }
  } catch (error) {
    console.error('Error checking P&L reminder:', error);
  }

  // 10. Payroll processing reminder (Fridays)
  try {
    const dayOfWeek = getDayOfWeek();
    if (dayOfWeek === 5) { // Friday
      smartItems.push({
        smart_key: 'payroll_processing',
        title: 'Process weekly payroll',
        description: 'Review hours and prepare payroll for the week',
        smart_count: 1,
        link_target: '/admin?tab=payroll',
        sort_order: 51,
        priority: 'high',
        category: 'compliance',
        metadata: JSON.stringify({ week_ending: today })
      });
    }
  } catch (error) {
    console.error('Error checking payroll reminder:', error);
  }

  return smartItems;
}

// Ensure today's items exist from templates and smart items
async function ensureTodaysItems(today) {
  const dayOfWeek = getDayOfWeek();
  const dayOfMonth = getDayOfMonth();

  // Get applicable templates
  const templates = await db.allAsync(`
    SELECT * FROM admin_worklist_templates
    WHERE enabled = 1
    AND (
      recurrence = 'daily'
      OR (recurrence = 'weekly' AND day_of_week = ?)
      OR (recurrence = 'monthly' AND day_of_month = ?)
    )
    ORDER BY sort_order ASC
  `, [dayOfWeek, dayOfMonth]);

  // Insert template-based items (skip if already exists)
  for (const template of templates) {
    try {
      await db.runAsync(`
        INSERT OR IGNORE INTO admin_worklist_items 
        (item_date, title, description, item_type, template_id, link_target, sort_order)
        VALUES (?, ?, ?, 'template', ?, ?, ?)
      `, [
        today,
        template.title,
        template.description,
        template.id,
        template.link_target,
        template.sort_order
      ]);
    } catch (error) {
      // Ignore unique constraint violations
      if (!error.message.includes('UNIQUE constraint')) {
        console.error('Error inserting template item:', error);
      }
    }
  }

  // Generate and upsert smart items
  const smartItems = await generateSmartItems(today);
  for (const item of smartItems) {
    try {
      // Check if exists
      const existing = await db.getAsync(
        'SELECT id, is_completed FROM admin_worklist_items WHERE item_date = ? AND smart_key = ?',
        [today, item.smart_key]
      );

      if (existing) {
        // Update count but preserve completion status
        await db.runAsync(`
          UPDATE admin_worklist_items
          SET title = ?, description = ?, smart_count = ?, link_target = ?, 
              priority = ?, category = ?, metadata = ?
          WHERE id = ?
        `, [
          item.title, 
          item.description, 
          item.smart_count, 
          item.link_target,
          item.priority || 'medium',
          item.category || 'general',
          item.metadata || null,
          existing.id
        ]);
      } else {
        // Insert new
        await db.runAsync(`
          INSERT INTO admin_worklist_items 
          (item_date, title, description, item_type, smart_key, smart_count, link_target, sort_order, priority, category, metadata)
          VALUES (?, ?, ?, 'smart', ?, ?, ?, ?, ?, ?, ?)
        `, [
          today,
          item.title,
          item.description,
          item.smart_key,
          item.smart_count,
          item.link_target,
          item.sort_order,
          item.priority || 'medium',
          item.category || 'general',
          item.metadata || null
        ]);
      }
    } catch (error) {
      console.error('Error upserting smart item:', error);
    }
  }

  // Remove smart items that no longer have counts (they've been resolved)
  const activeSmartKeys = smartItems.map(i => i.smart_key);
  if (activeSmartKeys.length === 0) {
    // Remove all smart items for today that aren't completed
    await db.runAsync(`
      DELETE FROM admin_worklist_items
      WHERE item_date = ? AND item_type = 'smart' AND is_completed = 0
    `, [today]);
  } else {
    // Remove smart items not in the active list (and not completed)
    const placeholders = activeSmartKeys.map(() => '?').join(',');
    await db.runAsync(`
      DELETE FROM admin_worklist_items
      WHERE item_date = ? AND item_type = 'smart' AND is_completed = 0 
      AND smart_key NOT IN (${placeholders})
    `, [today, ...activeSmartKeys]);
  }
}

// GET /api/admin/worklist/today - Get today's worklist
router.get('/today', async (req, res) => {
  try {
    const today = getTodayInCentral();
    
    // Ensure items exist
    await ensureTodaysItems(today);

    // Fetch all items for today
    const items = await db.allAsync(`
      SELECT 
        awi.*,
        u.full_name as completed_by_name,
        u2.full_name as assigned_to_name
      FROM admin_worklist_items awi
      LEFT JOIN users u ON awi.completed_by = u.id
      LEFT JOIN users u2 ON awi.assigned_to = u2.id
      WHERE awi.item_date = ?
      ORDER BY 
        CASE awi.priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        awi.item_type ASC, 
        awi.sort_order ASC, 
        awi.id ASC
    `, [today]);

    // Calculate summary
    const total = items.length;
    const completed = items.filter(i => i.is_completed === 1).length;
    const templateItems = items.filter(i => i.item_type === 'template' || i.item_type === 'manual');
    const smartItems = items.filter(i => i.item_type === 'smart');

    res.json({
      date: today,
      summary: {
        total,
        completed,
        remaining: total - completed,
        progress: total > 0 ? Math.round((completed / total) * 100) : 100
      },
      templateItems,
      smartItems,
      allItems: items
    });
  } catch (error) {
    console.error('Get today worklist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/worklist/items/:id/toggle - Toggle item completion
router.post('/items/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const item = await db.getAsync('SELECT * FROM admin_worklist_items WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const newCompleted = item.is_completed === 1 ? 0 : 1;
    const completedAt = newCompleted ? new Date().toISOString() : null;
    const completedBy = newCompleted ? req.user.id : null;

    await db.runAsync(`
      UPDATE admin_worklist_items
      SET is_completed = ?, completed_by = ?, completed_at = ?
      WHERE id = ?
    `, [newCompleted, completedBy, completedAt, id]);

    // If completing, add to history
    if (newCompleted === 1) {
      await db.runAsync(`
        INSERT INTO admin_worklist_history (item_id, completed_at, completed_by, time_taken_minutes, notes)
        VALUES (?, ?, ?, ?, ?)
      `, [id, completedAt, completedBy, item.actual_minutes || null, null]);
    }

    const updatedItem = await db.getAsync(`
      SELECT awi.*, u.full_name as completed_by_name, u2.full_name as assigned_to_name
      FROM admin_worklist_items awi
      LEFT JOIN users u ON awi.completed_by = u.id
      LEFT JOIN users u2 ON awi.assigned_to = u2.id
      WHERE awi.id = ?
    `, [id]);

    res.json({ item: updatedItem });
  } catch (error) {
    console.error('Toggle item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/worklist/items - Add manual item for today
router.post('/items', async (req, res) => {
  try {
    const { title, description, link_target } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const today = getTodayInCentral();
    
    // Get max sort order for manual items
    const maxOrder = await db.getAsync(`
      SELECT MAX(sort_order) as max FROM admin_worklist_items
      WHERE item_date = ? AND item_type = 'manual'
    `, [today]);

    const sortOrder = (maxOrder?.max || 50) + 1;

    const result = await db.runAsync(`
      INSERT INTO admin_worklist_items 
      (item_date, title, description, item_type, link_target, sort_order)
      VALUES (?, ?, ?, 'manual', ?, ?)
    `, [today, title, description || null, link_target || null, sortOrder]);

    const item = await db.getAsync(
      'SELECT * FROM admin_worklist_items WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({ item });
  } catch (error) {
    console.error('Add manual item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/worklist/items/:id - Delete manual item
router.delete('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const item = await db.getAsync('SELECT * FROM admin_worklist_items WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Only allow deleting manual items
    if (item.item_type !== 'manual') {
      return res.status(400).json({ error: 'Can only delete manual items' });
    }

    await db.runAsync('DELETE FROM admin_worklist_items WHERE id = ?', [id]);

    res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ TEMPLATES CRUD ============

// GET /api/admin/worklist/templates - Get all templates
router.get('/templates', async (req, res) => {
  try {
    const templates = await db.allAsync(`
      SELECT t.*, u.full_name as created_by_name
      FROM admin_worklist_templates t
      LEFT JOIN users u ON t.created_by = u.id
      ORDER BY t.sort_order ASC, t.id ASC
    `);

    res.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/worklist/templates - Create template
router.post('/templates', async (req, res) => {
  try {
    const { title, description, recurrence, day_of_week, day_of_month, link_target, sort_order, enabled } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!['daily', 'weekly', 'monthly'].includes(recurrence)) {
      return res.status(400).json({ error: 'Invalid recurrence type' });
    }

    const result = await db.runAsync(`
      INSERT INTO admin_worklist_templates 
      (title, description, recurrence, day_of_week, day_of_month, link_target, sort_order, enabled, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      description || null,
      recurrence,
      recurrence === 'weekly' ? day_of_week : null,
      recurrence === 'monthly' ? day_of_month : null,
      link_target || null,
      sort_order || 0,
      enabled !== false ? 1 : 0,
      req.user.id
    ]);

    const template = await db.getAsync(
      'SELECT * FROM admin_worklist_templates WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({ template });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/worklist/templates/:id - Update template
router.put('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, recurrence, day_of_week, day_of_month, link_target, sort_order, enabled } = req.body;

    const existing = await db.getAsync('SELECT * FROM admin_worklist_templates WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await db.runAsync(`
      UPDATE admin_worklist_templates
      SET title = ?, description = ?, recurrence = ?, day_of_week = ?, day_of_month = ?,
          link_target = ?, sort_order = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title !== undefined ? title : existing.title,
      description !== undefined ? description : existing.description,
      recurrence !== undefined ? recurrence : existing.recurrence,
      recurrence === 'weekly' ? day_of_week : null,
      recurrence === 'monthly' ? day_of_month : null,
      link_target !== undefined ? link_target : existing.link_target,
      sort_order !== undefined ? sort_order : existing.sort_order,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      id
    ]);

    const template = await db.getAsync('SELECT * FROM admin_worklist_templates WHERE id = ?', [id]);

    res.json({ template });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/worklist/templates/:id - Delete template
router.delete('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.getAsync('SELECT * FROM admin_worklist_templates WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await db.runAsync('DELETE FROM admin_worklist_templates WHERE id = ?', [id]);

    res.json({ message: 'Template deleted' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ ENHANCED ENDPOINTS ============

// PUT /api/admin/worklist/items/:id - Update item
router.put('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { priority, category, due_time, notes, estimated_minutes, assigned_to } = req.body;

    const existing = await db.getAsync('SELECT * FROM admin_worklist_items WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const updates = [];
    const values = [];

    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (due_time !== undefined) {
      updates.push('due_time = ?');
      values.push(due_time || null);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes || null);
    }
    if (estimated_minutes !== undefined) {
      updates.push('estimated_minutes = ?');
      values.push(estimated_minutes || null);
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      values.push(assigned_to || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await db.runAsync(`
      UPDATE admin_worklist_items
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    const updated = await db.getAsync(`
      SELECT awi.*, u.full_name as completed_by_name, u2.full_name as assigned_to_name
      FROM admin_worklist_items awi
      LEFT JOIN users u ON awi.completed_by = u.id
      LEFT JOIN users u2 ON awi.assigned_to = u2.id
      WHERE awi.id = ?
    `, [id]);

    res.json({ item: updated });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/worklist/items/:id/notes - Add/update notes
router.post('/items/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const existing = await db.getAsync('SELECT * FROM admin_worklist_items WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await db.runAsync('UPDATE admin_worklist_items SET notes = ? WHERE id = ?', [notes || null, id]);

    const updated = await db.getAsync('SELECT * FROM admin_worklist_items WHERE id = ?', [id]);
    res.json({ item: updated });
  } catch (error) {
    console.error('Update notes error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/worklist/items/:id/complete - Complete with time tracking
router.post('/items/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { actual_minutes, notes: completionNotes } = req.body;

    const item = await db.getAsync('SELECT * FROM admin_worklist_items WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.is_completed === 1) {
      return res.status(400).json({ error: 'Item already completed' });
    }

    const completedAt = new Date().toISOString();
    const completedBy = req.user.id;

    // Update item
    await db.runAsync(`
      UPDATE admin_worklist_items
      SET is_completed = 1, completed_by = ?, completed_at = ?, actual_minutes = ?
      WHERE id = ?
    `, [completedBy, completedAt, actual_minutes || null, id]);

    // Add to history
    await db.runAsync(`
      INSERT INTO admin_worklist_history (item_id, completed_at, completed_by, time_taken_minutes, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [id, completedAt, completedBy, actual_minutes || null, completionNotes || null]);

    const updated = await db.getAsync(`
      SELECT awi.*, u.full_name as completed_by_name
      FROM admin_worklist_items awi
      LEFT JOIN users u ON awi.completed_by = u.id
      WHERE awi.id = ?
    `, [id]);

    res.json({ item: updated });
  } catch (error) {
    console.error('Complete item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/worklist/items/:id/details - Get detailed context for an item
router.get('/items/:id/details', async (req, res) => {
  try {
    const { id } = req.params;

    const item = await db.getAsync(`
      SELECT awi.*, u.full_name as completed_by_name, u2.full_name as assigned_to_name
      FROM admin_worklist_items awi
      LEFT JOIN users u ON awi.completed_by = u.id
      LEFT JOIN users u2 ON awi.assigned_to = u2.id
      WHERE awi.id = ?
    `, [id]);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Get completion history
    const history = await db.allAsync(`
      SELECT awh.*, u.full_name as completed_by_name
      FROM admin_worklist_history awh
      LEFT JOIN users u ON awh.completed_by = u.id
      WHERE awh.item_id = ?
      ORDER BY awh.completed_at DESC
    `, [id]);

    // Get related items based on metadata
    let relatedItems = [];
    if (item.metadata) {
      try {
        const metadata = JSON.parse(item.metadata);
        if (item.smart_key === 'pending_time_off' && metadata.request_ids) {
          const requests = await db.allAsync(`
            SELECT se.*, u.full_name
            FROM schedule_entries se
            JOIN users u ON se.user_id = u.id
            WHERE se.id IN (${metadata.request_ids.map(() => '?').join(',')})
          `, metadata.request_ids);
          relatedItems = requests;
        } else if (item.smart_key === 'tasks_in_review' && metadata.task_ids) {
          const tasks = await db.allAsync(`
            SELECT t.*, u.full_name as assigned_to_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.id IN (${metadata.task_ids.map(() => '?').join(',')})
          `, metadata.task_ids);
          relatedItems = tasks;
        } else if (item.smart_key === 'unapproved_time_entries' && metadata.entry_ids) {
          const entries = await db.allAsync(`
            SELECT te.*, u.full_name
            FROM time_entries te
            JOIN users u ON te.user_id = u.id
            WHERE te.id IN (${metadata.entry_ids.map(() => '?').join(',')})
          `, metadata.entry_ids);
          relatedItems = entries;
        }
      } catch (error) {
        console.error('Error parsing metadata:', error);
      }
    }

    res.json({
      item,
      history,
      relatedItems
    });
  } catch (error) {
    console.error('Get item details error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/worklist/history - Get completion history
router.get('/history', async (req, res) => {
  try {
    const { start_date, end_date, category, limit = 100 } = req.query;

    let query = `
      SELECT 
        awh.*,
        awi.title, awi.category, awi.smart_key,
        u.full_name as completed_by_name
      FROM admin_worklist_history awh
      JOIN admin_worklist_items awi ON awh.item_id = awi.id
      LEFT JOIN users u ON awh.completed_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND DATE(awh.completed_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND DATE(awh.completed_at) <= ?';
      params.push(end_date);
    }
    if (category) {
      query += ' AND awi.category = ?';
      params.push(category);
    }

    query += ' ORDER BY awh.completed_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const history = await db.allAsync(query, params);

    res.json({ history });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/worklist/stats - Get statistics
router.get('/stats', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const today = getTodayInCentral();

    const startDate = start_date || today;
    const endDate = end_date || today;

    // Completion rate
    const completionStats = await db.getAsync(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed,
        AVG(CASE WHEN is_completed = 1 AND actual_minutes IS NOT NULL THEN actual_minutes ELSE NULL END) as avg_time_minutes
      FROM admin_worklist_items
      WHERE item_date >= ? AND item_date <= ?
    `, [startDate, endDate]);

    // Category breakdown
    const categoryStats = await db.allAsync(`
      SELECT 
        category,
        COUNT(*) as total,
        SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
      FROM admin_worklist_items
      WHERE item_date >= ? AND item_date <= ?
      GROUP BY category
    `, [startDate, endDate]);

    // Priority breakdown
    const priorityStats = await db.allAsync(`
      SELECT 
        priority,
        COUNT(*) as total,
        SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
      FROM admin_worklist_items
      WHERE item_date >= ? AND item_date <= ?
      GROUP BY priority
    `, [startDate, endDate]);

    // Most time-consuming items
    const timeConsuming = await db.allAsync(`
      SELECT 
        awi.title, awi.category, awi.actual_minutes,
        u.full_name as completed_by_name
      FROM admin_worklist_items awi
      LEFT JOIN users u ON awi.completed_by = u.id
      WHERE awi.item_date >= ? AND awi.item_date <= ?
        AND awi.actual_minutes IS NOT NULL
        AND awi.actual_minutes > 0
      ORDER BY awi.actual_minutes DESC
      LIMIT 10
    `, [startDate, endDate]);

    res.json({
      completionRate: completionStats.total > 0 
        ? Math.round((completionStats.completed / completionStats.total) * 100) 
        : 0,
      averageTimeMinutes: completionStats.avg_time_minutes || 0,
      totalItems: completionStats.total || 0,
      completedItems: completionStats.completed || 0,
      categoryBreakdown: categoryStats,
      priorityBreakdown: priorityStats,
      timeConsumingItems: timeConsuming
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ QUICK ACTION ENDPOINTS ============

// POST /api/admin/worklist/items/:id/quick-approve-time - Approve time entry
router.post('/items/:id/quick-approve-time', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await db.getAsync('SELECT * FROM admin_worklist_items WHERE id = ?', [id]);
    
    if (!item || item.smart_key !== 'unapproved_time_entries') {
      return res.status(400).json({ error: 'Invalid item for this action' });
    }

    if (!item.metadata) {
      return res.status(400).json({ error: 'No metadata available' });
    }

    const metadata = JSON.parse(item.metadata);
    if (!metadata.entry_ids || metadata.entry_ids.length === 0) {
      return res.status(400).json({ error: 'No time entries to approve' });
    }

    // Approve all time entries
    await db.runAsync(`
      UPDATE time_entries
      SET approved_by = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id IN (${metadata.entry_ids.map(() => '?').join(',')})
    `, [req.user.id, ...metadata.entry_ids]);

    // Mark worklist item as completed
    await db.runAsync(`
      UPDATE admin_worklist_items
      SET is_completed = 1, completed_by = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.user.id, id]);

    res.json({ message: 'Time entries approved', item });
  } catch (error) {
    console.error('Quick approve time error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/worklist/items/:id/quick-approve-task - Approve task
router.post('/items/:id/quick-approve-task', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await db.getAsync('SELECT * FROM admin_worklist_items WHERE id = ?', [id]);
    
    if (!item || item.smart_key !== 'tasks_in_review') {
      return res.status(400).json({ error: 'Invalid item for this action' });
    }

    if (!item.metadata) {
      return res.status(400).json({ error: 'No metadata available' });
    }

    const metadata = JSON.parse(item.metadata);
    if (!metadata.task_ids || metadata.task_ids.length === 0) {
      return res.status(400).json({ error: 'No tasks to approve' });
    }

    // Approve all tasks
    await db.runAsync(`
      UPDATE tasks
      SET status = 'completed', approved_by = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id IN (${metadata.task_ids.map(() => '?').join(',')})
    `, [req.user.id, ...metadata.task_ids]);

    // Mark worklist item as completed
    await db.runAsync(`
      UPDATE admin_worklist_items
      SET is_completed = 1, completed_by = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.user.id, id]);

    res.json({ message: 'Tasks approved', item });
  } catch (error) {
    console.error('Quick approve task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/worklist/items/:id/quick-approve-timeoff - Approve time off
router.post('/items/:id/quick-approve-timeoff', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await db.getAsync('SELECT * FROM admin_worklist_items WHERE id = ?', [id]);
    
    if (!item || item.smart_key !== 'pending_time_off') {
      return res.status(400).json({ error: 'Invalid item for this action' });
    }

    if (!item.metadata) {
      return res.status(400).json({ error: 'No metadata available' });
    }

    const metadata = JSON.parse(item.metadata);
    if (!metadata.request_ids || metadata.request_ids.length === 0) {
      return res.status(400).json({ error: 'No time off requests to approve' });
    }

    // Approve all time off requests
    await db.runAsync(`
      UPDATE schedule_entries
      SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id IN (${metadata.request_ids.map(() => '?').join(',')})
    `, [req.user.id, ...metadata.request_ids]);

    // Mark worklist item as completed
    await db.runAsync(`
      UPDATE admin_worklist_items
      SET is_completed = 1, completed_by = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.user.id, id]);

    res.json({ message: 'Time off requests approved', item });
  } catch (error) {
    console.error('Quick approve timeoff error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ BULK ACTIONS ============

// POST /api/admin/worklist/bulk-complete - Bulk complete items
router.post('/bulk-complete', async (req, res) => {
  try {
    const { item_ids } = req.body;
    
    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ error: 'item_ids array is required' });
    }

    const completedAt = new Date().toISOString();
    const placeholders = item_ids.map(() => '?').join(',');

    // Update items
    await db.runAsync(`
      UPDATE admin_worklist_items
      SET is_completed = 1, completed_by = ?, completed_at = ?
      WHERE id IN (${placeholders}) AND is_completed = 0
    `, [req.user.id, completedAt, ...item_ids]);

    // Add to history
    const items = await db.allAsync(`
      SELECT id FROM admin_worklist_items
      WHERE id IN (${placeholders}) AND is_completed = 1
    `, item_ids);

    for (const item of items) {
      await db.runAsync(`
        INSERT INTO admin_worklist_history (item_id, completed_at, completed_by)
        VALUES (?, ?, ?)
      `, [item.id, completedAt, req.user.id]);
    }

    res.json({ message: `${items.length} items completed` });
  } catch (error) {
    console.error('Bulk complete error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/worklist/bulk-update - Bulk update priority/category
router.post('/bulk-update', async (req, res) => {
  try {
    const { item_ids, priority, category } = req.body;
    
    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ error: 'item_ids array is required' });
    }

    const updates = [];
    const values = [];

    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const placeholders = item_ids.map(() => '?').join(',');
    values.push(...item_ids);

    await db.runAsync(`
      UPDATE admin_worklist_items
      SET ${updates.join(', ')}
      WHERE id IN (${placeholders})
    `, values);

    res.json({ message: `${item_ids.length} items updated` });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/worklist/bulk-delete - Bulk delete manual items
router.post('/bulk-delete', async (req, res) => {
  try {
    const { item_ids } = req.body;
    
    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ error: 'item_ids array is required' });
    }

    const placeholders = item_ids.map(() => '?').join(',');

    // Only delete manual items
    const result = await db.runAsync(`
      DELETE FROM admin_worklist_items
      WHERE id IN (${placeholders}) AND item_type = 'manual'
    `, item_ids);

    res.json({ message: 'Items deleted' });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════
// Daily Focus
// ═══════════════════════════════════════════════════════════

// GET /api/admin/worklist/focus - Get focus text for a date
router.get('/focus', async (req, res) => {
  try {
    const date = req.query.date || getTodayInCentral();
    const userId = req.user.id;

    // Ensure table exists
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS admin_worklist_daily_focus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        focus_date DATE NOT NULL,
        focus_text TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(focus_date, user_id)
      )
    `);

    const row = await db.getAsync(
      'SELECT focus_text FROM admin_worklist_daily_focus WHERE focus_date = ? AND user_id = ?',
      [date, userId]
    );

    res.json({ focus_text: row?.focus_text || '' });
  } catch (error) {
    console.error('Get focus error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/worklist/focus - Save focus text for a date
router.post('/focus', async (req, res) => {
  try {
    const { date, focus_text } = req.body;
    const focusDate = date || getTodayInCentral();
    const userId = req.user.id;

    // Ensure table exists
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS admin_worklist_daily_focus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        focus_date DATE NOT NULL,
        focus_text TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(focus_date, user_id)
      )
    `);

    const existing = await db.getAsync(
      'SELECT id FROM admin_worklist_daily_focus WHERE focus_date = ? AND user_id = ?',
      [focusDate, userId]
    );

    if (existing) {
      await db.runAsync(
        'UPDATE admin_worklist_daily_focus SET focus_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [focus_text || '', existing.id]
      );
    } else {
      await db.runAsync(
        'INSERT INTO admin_worklist_daily_focus (focus_date, focus_text, user_id) VALUES (?, ?, ?)',
        [focusDate, focus_text || '', userId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Save focus error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════
// Goals
// ═══════════════════════════════════════════════════════════

async function ensureGoalsTable() {
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS admin_worklist_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      period_type TEXT CHECK(period_type IN ('week', 'month', 'quarter')) DEFAULT 'week',
      target_date DATE,
      is_completed INTEGER DEFAULT 0,
      completed_at DATETIME,
      sort_order INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// GET /api/admin/worklist/goals - List all goals
router.get('/goals', async (req, res) => {
  try {
    await ensureGoalsTable();

    const goals = await db.allAsync(`
      SELECT g.*, u.full_name as created_by_name
      FROM admin_worklist_goals g
      LEFT JOIN users u ON g.created_by = u.id
      ORDER BY g.is_completed ASC, g.sort_order ASC, g.created_at DESC
    `);

    res.json({ goals });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/worklist/goals - Create a goal
router.post('/goals', async (req, res) => {
  try {
    await ensureGoalsTable();

    const { title, description, period_type, target_date } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const maxOrder = await db.getAsync('SELECT MAX(sort_order) as max FROM admin_worklist_goals');
    const sortOrder = (maxOrder?.max || 0) + 1;

    const result = await db.runAsync(
      `INSERT INTO admin_worklist_goals (title, description, period_type, target_date, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description || null, period_type || 'week', target_date || null, sortOrder, req.user.id]
    );

    const goal = await db.getAsync('SELECT * FROM admin_worklist_goals WHERE id = ?', [result.lastID]);
    res.status(201).json({ goal });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/worklist/goals/:id/toggle - Toggle goal completion
router.post('/goals/:id/toggle', async (req, res) => {
  try {
    await ensureGoalsTable();

    const { id } = req.params;
    const goal = await db.getAsync('SELECT * FROM admin_worklist_goals WHERE id = ?', [id]);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const newCompleted = goal.is_completed === 1 ? 0 : 1;
    const completedAt = newCompleted ? new Date().toISOString() : null;

    await db.runAsync(
      'UPDATE admin_worklist_goals SET is_completed = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newCompleted, completedAt, id]
    );

    const updated = await db.getAsync('SELECT * FROM admin_worklist_goals WHERE id = ?', [id]);
    res.json({ goal: updated });
  } catch (error) {
    console.error('Toggle goal error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/worklist/goals/:id - Delete a goal
router.delete('/goals/:id', async (req, res) => {
  try {
    await ensureGoalsTable();

    const { id } = req.params;
    const goal = await db.getAsync('SELECT * FROM admin_worklist_goals WHERE id = ?', [id]);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    await db.runAsync('DELETE FROM admin_worklist_goals WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
