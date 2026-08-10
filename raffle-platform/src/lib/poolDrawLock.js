/** Matches Apps Script entryUpdateLockedForRaffleIds_ margin (T−10 minutes). */
export const DRAW_LOCK_MARGIN_MS = 10 * 60 * 1000;

/**
 * True when any of the given pool IDs is inside its draw lock window
 * (now >= drawAt − 10 minutes). Pools without a parseable drawAt are never locked.
 *
 * @param {Array<{ id?: string, drawAt?: string }>} pools
 * @param {string[]} poolIds
 * @param {number} [nowMs]
 */
export function isAnyPoolDrawLocked(pools, poolIds, nowMs = Date.now()) {
  const byId = new Map((pools || []).map((p) => [String(p.id), p]));
  for (const rawId of poolIds || []) {
    const id = String(rawId || "").trim();
    if (!id) continue;
    const pool = byId.get(id);
    const raw = pool?.drawAt != null ? String(pool.drawAt).trim() : "";
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (!Number.isNaN(ms) && nowMs >= ms - DRAW_LOCK_MARGIN_MS) return true;
  }
  return false;
}
