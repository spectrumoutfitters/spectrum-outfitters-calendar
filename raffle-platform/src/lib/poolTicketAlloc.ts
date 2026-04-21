/** Integer ticket counts per pool id (0 = not in that drawing). */

export function emptyPoolTickets(orderedIds: string[]): Record<string, number> {
  return Object.fromEntries(orderedIds.map((id) => [id, 0]));
}

/** Put the full total on the first pool; others 0. */
export function defaultPoolTickets(orderedIds: string[], total: number): Record<string, number> {
  const out = emptyPoolTickets(orderedIds);
  const n = Math.max(0, Math.floor(total));
  if (orderedIds.length && n > 0) out[orderedIds[0]] = n;
  return out;
}

/**
 * Keep integer counts per pool; adjust so the sum matches `targetTotal` when bonuses change.
 * If nothing was assigned, assign everything to the first pool.
 */
export function reconcilePoolTickets(
  orderedIds: string[],
  prev: Record<string, number>,
  targetTotal: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of orderedIds) {
    out[id] = Math.max(0, Math.floor(Number(prev[id]) || 0));
  }
  const t = Math.max(0, Math.floor(targetTotal));
  if (!orderedIds.length) return out;

  let sum = orderedIds.reduce((s, id) => s + out[id], 0);
  if (t === 0) {
    for (const id of orderedIds) out[id] = 0;
    return out;
  }
  if (sum === 0) {
    out[orderedIds[0]] = t;
    return out;
  }
  if (sum < t) {
    out[orderedIds[0]] += t - sum;
    return out;
  }
  if (sum > t) {
    let over = sum - t;
    for (let i = orderedIds.length - 1; i >= 0 && over > 0; i--) {
      const id = orderedIds[i];
      const cut = Math.min(out[id], over);
      out[id] -= cut;
      over -= cut;
    }
    return out;
  }
  return out;
}

export function sumPoolTickets(orderedIds: string[], poolTickets: Record<string, number>): number {
  return orderedIds.reduce((s, id) => s + (Number(poolTickets[id]) || 0), 0);
}

export function countPositivePools(orderedIds: string[], poolTickets: Record<string, number>): number {
  return orderedIds.filter((id) => (Number(poolTickets[id]) || 0) > 0).length;
}
