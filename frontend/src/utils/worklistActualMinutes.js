/**
 * Coerce the Work List "actual minutes" input for POST /admin/worklist/items/:id/complete.
 * Empty/falsy stays null so stats AVG(actual_minutes) ignores the row; non-empty uses parseInt
 * (so "0" is 0, "45min" is 45, and "abc" is NaN — JSON then serializes NaN as null).
 */
export function coerceWorklistActualMinutes(raw) {
  return raw ? parseInt(raw) : null;
}
