const WORKLIST_CATEGORY_LABELS = {
  time_approval: 'Time Approval',
  task_review: 'Task Review',
  compliance: 'Compliance',
  inventory: 'Inventory',
  general: 'General',
};

/** Percent complete for a worklist bucket. Empty buckets are 0, not NaN. */
export function completionPercent(completed, total) {
  if (!(Number(total) > 0)) return 0;
  return Math.round((Number(completed) / Number(total)) * 100);
}

export function worklistCategoryLabel(category) {
  return WORKLIST_CATEGORY_LABELS[category] || category;
}

/** KPI tile. A missing or zero average is shown as a dash, not "0m". */
export function formatAverageWorkMinutes(averageTimeMinutes) {
  return averageTimeMinutes ? `${Math.round(averageTimeMinutes)}m` : '-';
}

/** History row. Zero minutes is shown as a dash, same as a missing value. */
export function formatHistoryMinutes(minutes) {
  return minutes ? `${minutes} min` : '-';
}

export function worklistStatsSearchParams({ start_date, end_date } = {}) {
  const params = new URLSearchParams();
  if (start_date) params.append('start_date', start_date);
  if (end_date) params.append('end_date', end_date);
  return params;
}

/**
 * "All Categories" must not be sent as a category filter.
 * The API would otherwise look for a category literally named all.
 */
export function worklistHistorySearchParams({ start_date, end_date, category } = {}) {
  const params = new URLSearchParams();
  if (start_date) params.append('start_date', start_date);
  if (end_date) params.append('end_date', end_date);
  if (category !== 'all') params.append('category', category);
  return params;
}
