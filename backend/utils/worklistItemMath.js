/**
 * My-worklist query/create/toggle coercion.
 * Wired into routes/myWorklist.js — keep behavior identical.
 */

/** GET ?archived= is archived only for exact `'1'` or `'true'` (not `1` / `'True'`). */
export function isArchivedQuery(archived) {
  return archived === '1' || archived === 'true';
}

/** Create: unknown / missing priority becomes `'medium'`. PUT only accepts the same three values. */
export function coerceCreatePriority(priority) {
  return ['high', 'medium', 'low'].includes(priority) ? priority : 'medium';
}

export function isValidWorklistPriority(priority) {
  return ['high', 'medium', 'low'].includes(priority);
}

/** PUT title: ignore missing/whitespace-only; otherwise title-case the trimmed string. */
export function coerceWorklistTitleUpdate(title) {
  if (title === undefined) return null;
  const trimmed = String(title).trim();
  if (!trimmed) return null;
  return toTitleCase(trimmed);
}

export function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Empty list reports 100% progress. Completed uses strict `is_completed === 1`.
 */
export function worklistProgress(items) {
  const list = items || [];
  const total = list.length;
  const completed = list.filter((i) => i.is_completed === 1).length;
  return {
    total,
    completed,
    remaining: total - completed,
    progress: total > 0 ? Math.round((completed / total) * 100) : 100,
  };
}

/**
 * Toggle completion. Unchecking clears archive (`archived_at = null`);
 * checking keeps the existing archived_at value.
 * `is_completed === 1` only (string `'1'` is treated as incomplete → completes).
 * Caller sets `completed_at` to now when `is_completed === 1`, else null.
 */
export function nextWorklistToggle(item) {
  const is_completed = item?.is_completed === 1 ? 0 : 1;
  return {
    is_completed,
    archived_at: is_completed ? item.archived_at : null,
  };
}
