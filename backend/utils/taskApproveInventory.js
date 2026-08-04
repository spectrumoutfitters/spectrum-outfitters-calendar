/**
 * Pure helpers for task-approve inventory deduction.
 * Stock must use atomic SQL `quantity = MAX(0, quantity - ?)` (not absolute SET)
 * so concurrent approvals cannot lose updates; callers should also skip when
 * the task is already admin_approved to prevent double-deduction.
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
