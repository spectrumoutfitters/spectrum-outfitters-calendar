/**
 * Affiliates admin: public link URL fallback, employee assignee filter,
 * and assigned_user_id coerce.
 * Distinct from backend affiliate customer landing URLs (#74) and
 * public-track / commission math (#99).
 */

export function buildAffiliateAdminUrl({ origin, basePath, token }) {
  const originSafe = origin || '';
  const base = basePath || '';
  return `${originSafe}${base}/affiliates/${token}`;
}

export function isAffiliateAssignableEmployee(user) {
  return user?.role === 'employee' && user?.is_active !== 0;
}

/** Empty / falsy → null (current create-link payload). Truthy strings become Number. */
export function coerceAssignedUserId(raw) {
  return raw ? Number(raw) : null;
}
