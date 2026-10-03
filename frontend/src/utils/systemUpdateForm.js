/**
 * Admin system-update form and row flags.
 * Edit checkboxes and badges use strict === 1 (SQLite), distinct from the
 * backend write coercions that treat any truthy value as on.
 */

export function systemUpdateEditFlags(update) {
  return {
    show_on_login: update?.show_on_login === 1,
    is_active: update?.is_active === 1,
  };
}

export function systemUpdateRowFlags(update) {
  return {
    pending: update?.is_pending === 1,
    active: update?.is_active === 1,
    showOnLogin: update?.show_on_login === 1 && update?.is_pending !== 1,
  };
}

export function systemUpdateReadPercentage(readCount, totalUsers) {
  if (!totalUsers || totalUsers === 0) return 0;
  return Math.round((readCount / totalUsers) * 100);
}

export function systemUpdateSaveMessage(editing, autoApprove) {
  if (editing) return 'Update updated successfully!';
  if (autoApprove) return 'Update created and published immediately!';
  return 'Update created and pending approval!';
}

/** Empty selection must not call bulk-approve. */
export function bulkApproveBlockReason(selectedCount) {
  if (!selectedCount) return 'Please select at least one update to approve';
  return null;
}
