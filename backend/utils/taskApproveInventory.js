/**
 * Pure helpers + shared side effects for task-approve inventory deduction.
 * Stock must use atomic SQL `quantity = MAX(0, quantity - ?)` (not absolute SET)
 * so concurrent approvals cannot lose updates; callers should also skip when
 * the task is already admin_approved to prevent double-deduction.
 *
 * Completing a task via status PUT (Kanban / mark-done) must use the same
 * first-finalize gate: after status becomes `completed`, the UI no longer
 * offers Approve, so inventory would otherwise stay phantom forever.
 */

/** @param {unknown} quantityUsed */
export function resolveTaskApproveDeductQty(quantityUsed) {
  if (quantityUsed != null && Number(quantityUsed) > 0) return Number(quantityUsed);
  return 1;
}

/**
 * Expected on-hand after approve deduction (mirrors SQLite MAX(0, qty - deduct)).
 * @param {number} quantityBefore
 * @param {number} deduct
 */
export function quantityAfterApproveDeduct(quantityBefore, deduct) {
  const before = Number(quantityBefore) || 0;
  const d = Number(deduct) || 0;
  return Math.max(0, before - d);
}

/** @param {{ admin_approved?: unknown } | null | undefined} task */
export function shouldApplyTaskApproveInventory(task) {
  return !task?.admin_approved;
}

/**
 * Atomically transition a task to admin-approved + completed (first approver wins).
 * @returns {Promise<boolean>} true when this call performed the 0→1 transition
 */
export async function markTaskAdminApproved(db, { taskId, userId, archive = false }) {
  const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return false;

  const updateFields = [
    "status = 'completed'",
    'admin_approved = 1',
    `is_archived = ${archive ? 1 : 0}`,
    'updated_at = CURRENT_TIMESTAMP',
  ];
  const updateParams = [];

  if (!task.completed_at) {
    updateFields.push('completed_at = ?');
    updateFields.push('completed_by = ?');
    updateParams.push(new Date().toISOString());
    updateParams.push(userId);
  }

  updateParams.push(taskId);

  const approveResult = await db.runAsync(
    `UPDATE tasks SET ${updateFields.join(', ')}
     WHERE id = ? AND (admin_approved IS NULL OR admin_approved = 0)`,
    updateParams
  );
  return Boolean(approveResult?.changes);
}

/**
 * Claim the one-time inventory finalize when a task reaches `completed` via
 * status PUT (not /approve). Does not change status/completed_at (caller already did).
 * @returns {Promise<boolean>} true when this call claimed the 0→1 transition
 */
export async function claimTaskCompletionInventoryFinalize(db, { taskId }) {
  const result = await db.runAsync(
    `UPDATE tasks
     SET admin_approved = 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND (admin_approved IS NULL OR admin_approved = 0)`,
    [taskId]
  );
  return Boolean(result?.changes);
}

/**
 * Decrement inventory for parts linked on a task (call only after first finalize).
 */
export async function deductInventoryForApprovedTask(db, { taskId, userId }) {
  const usages = await db.allAsync(
    'SELECT item_id, quantity_used FROM task_inventory_usage WHERE task_id = ?',
    [taskId]
  );
  for (const u of usages || []) {
    const deduct = resolveTaskApproveDeductQty(u.quantity_used);
    const beforeRow = await db.getAsync('SELECT id, quantity FROM inventory_items WHERE id = ?', [u.item_id]);
    if (!beforeRow) continue;
    const before = Number(beforeRow.quantity) || 0;

    await db.runAsync(
      `UPDATE inventory_items
       SET quantity = MAX(0, quantity - ?),
           last_counted_at = CURRENT_TIMESTAMP,
           last_counted_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [deduct, userId, u.item_id]
    );
    const afterRow = await db.getAsync('SELECT quantity FROM inventory_items WHERE id = ?', [u.item_id]);
    const after = Number(afterRow?.quantity) || 0;
    try {
      await db.runAsync(
        `INSERT INTO inventory_quantity_log (item_id, quantity_before, quantity_after, changed_by, reason, task_id, notes)
         VALUES (?, ?, ?, ?, 'task_approved', ?, ?)`,
        [u.item_id, before, after, userId, taskId, 'Approved task inventory decrement']
      );
    } catch (_) {
      await db
        .runAsync(
          `INSERT INTO inventory_quantity_log (item_id, quantity_before, quantity_after, changed_by, reason) VALUES (?, ?, ?, ?, 'task_approved')`,
          [u.item_id, before, after, userId]
        )
        .catch(() => {});
    }
  }
}

/**
 * If the task just transitioned into `completed`, claim first finalize + deduct stock.
 * Safe to call from status PUT and general task PUT; no-ops when already finalized.
 */
export async function finalizeInventoryOnTaskCompleted(db, {
  taskId,
  userId,
  previousStatus,
  nextStatus,
}) {
  if (nextStatus !== 'completed' || previousStatus === 'completed') return false;
  const claimed = await claimTaskCompletionInventoryFinalize(db, { taskId });
  if (!claimed) return false;
  await db.runAsync(
    'INSERT INTO task_history (task_id, changed_by, field_changed, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
    [taskId, userId, 'admin_approved', '0', '1']
  ).catch(() => {});
  await deductInventoryForApprovedTask(db, { taskId, userId });
  return true;
}
