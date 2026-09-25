/**
 * Admin time-history query params.
 * Lunch history sends the date inputs as-is.
 * Punch history appends literal UTC day bounds (Z), not a Houston offset.
 * An empty punch-type filter keeps every row; a set type is an exact match.
 */

function withUserId(params, userId) {
  if (userId) params.user_id = userId;
  return params;
}

export function lunchHistoryParams({ from, to, userId }) {
  return withUserId({ from, to }, userId);
}

export function punchHistoryParams({ from, to, userId }) {
  return withUserId({
    from: from + 'T00:00:00.000Z',
    to: to + 'T23:59:59.999Z',
  }, userId);
}

export function filterPunchesByType(punches, punchType) {
  const list = punches || [];
  if (punchType) return list.filter((p) => p.type === punchType);
  return list;
}
