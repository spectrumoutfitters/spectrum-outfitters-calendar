/**
 * Pure helpers for Plaid transaction persist/list/categorize coercion.
 * Bank rows feed weekly P&L expenses — keep pending/category/currency quirks frozen.
 */

/**
 * Fields written on add/modify. Empty merchant becomes null; empty currency becomes USD.
 * Category prefers personal_finance_category.primary (empty string falls through);
 * otherwise joins the legacy category array. A truthy empty array joins to ''.
 * Pending uses JS truthiness (`'false'` stores 1).
 */
export function mapPlaidTxnPersistFields(txn = {}) {
  return {
    merchant_name: txn.merchant_name || null,
    category:
      txn.personal_finance_category?.primary ||
      (txn.category ? txn.category.join(' > ') : null),
    pending: txn.pending ? 1 : 0,
    iso_currency_code: txn.iso_currency_code || 'USD',
  };
}

/** `item_id || null` so '' / 0 / false mean "sync all items". */
export function parsePlaidSyncItemId(itemId) {
  return itemId || null;
}

/**
 * GET /transactions filter. Only the exact string `'true'` maps to business=1.
 * `'1'`, `'false'`, and boolean true all become 0. Undefined skips the filter.
 */
export function parsePlaidBusinessExpenseQuery(isBusinessExpense) {
  if (isBusinessExpense === undefined) return { apply: false, value: undefined };
  return { apply: true, value: isBusinessExpense === 'true' ? 1 : 0 };
}

/**
 * PUT /transactions/:id/categorize. Any truthy flag (including `'false'`) stores 1.
 * Falsy expense_category (including '') becomes null.
 */
export function plaidCategorizeUpdateValues({ is_business_expense, expense_category } = {}) {
  return {
    is_business_expense: is_business_expense ? 1 : 0,
    expense_category: expense_category || null,
  };
}
