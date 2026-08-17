/**
 * Pure helpers for product create/update coercion and employee visibility.
 * Extracted from routes/products.js — keep behavior identical.
 */

/** Only exact role `'admin'` sees inactive products on GET /. */
export function canSeeInactiveProducts(role) {
  return role === 'admin';
}

/**
 * Create: required-field gate uses `!name || !price`.
 * Price `0` / `''` / `null` is treated as missing (falsy).
 */
export function isProductCreateMissing(name, price) {
  return !name || !price;
}

/**
 * Create is_active: everything except the string `'false'` stores 1
 * (including boolean `false`, `0`, `'0'`, omitted).
 */
export function coerceCreateIsActive(isActive) {
  return isActive !== 'false' ? 1 : 0;
}

/**
 * Update is_active: omitted keeps current; otherwise only exact `'true'`
 * or boolean `true` store 1 (numeric `1` / `'1'` / `'TRUE'` store 0).
 */
export function coerceUpdateIsActive(isActive, current) {
  if (isActive === undefined) return current;
  return isActive === 'true' || isActive === true ? 1 : 0;
}

export function coerceProductPrice(price, current) {
  return price !== undefined ? parseFloat(price) : current;
}

/** Create description: empty / omitted → null via `description || null`. */
export function coerceCreateDescription(description) {
  return description || null;
}

export function coerceUpdateDescription(description, current) {
  return description !== undefined ? description : current;
}

/** Update name: falsy incoming keeps the stored name (`name || current`). */
export function coerceUpdateName(name, current) {
  return name || current;
}
