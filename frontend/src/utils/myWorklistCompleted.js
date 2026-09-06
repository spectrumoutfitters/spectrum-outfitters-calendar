/**
 * My Work List pending / completed split.
 * Uses truthy `is_completed` — distinct from Admin #114 which drops only `=== 1`.
 *
 * String `'0'` / `'1'` / `true` are completed here; Admin still treats `'1'` / `true`
 * as pending. Do not "fix" — this locks the employee-list predicate.
 */

export function isMyWorklistCompleted(item) {
  return !!item?.is_completed;
}

export function partitionMyWorklistItems(items) {
  const pendingItems = items.filter((i) => !i.is_completed);
  const completedItems = items.filter((i) => i.is_completed);
  return { pendingItems, completedItems };
}
