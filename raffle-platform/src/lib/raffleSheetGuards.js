/**
 * Pure guards mirroring Apps Script raffle sheet refund / newsletter update rules.
 * Kept in sync with raffle-platform/google-apps-script/Code.gs (handleRefundPaidPurchase_,
 * handleApplyPaidTickets_, handleUpdateEntryByToken_ editable-row selection).
 */

/** Inclusive end row for Entries data reads — must include getLastRow(), never lastRow-1. */
export function entriesDataEndRow(lastRow) {
  const n = Math.floor(Number(lastRow) || 0);
  return n < 2 ? null : n;
}

/**
 * Whether a manage-entry update should delete this sheet row when rewriting free totals.
 * Paid rows are always preserved. Legacy __newsletterBonus rows are deleted when newsletter
 * is still opted in (bonus is folded into free totals); otherwise they are preserved.
 */
export function shouldRewriteEntryRowOnUpdate(extras, newsletterOptIn) {
  const ex = extras && typeof extras === "object" ? extras : {};
  if (ex.__paid === true) return false;
  if (ex.__newsletterBonus === true && !newsletterOptIn) return false;
  return true;
}

/**
 * Late webhook must not grant tickets after a refund marker (Script Properties and/or sheet).
 */
export function shouldSkipPaidApplyDueToRefund({ propertyMarked, sheetHasRefundedSession }) {
  return Boolean(propertyMarked || sheetHasRefundedSession);
}
