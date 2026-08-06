/**
 * Pure free/busy interval overlap check for public booking slots.
 */

/**
 * True when [startMs, endMs) overlaps any busy interval with parseable start/end.
 * @param {number} startMs
 * @param {number} endMs
 * @param {{ start?: string, end?: string }[]|null|undefined} intervals
 */
export function overlapsInterval(startMs, endMs, intervals) {
  for (const b of intervals || []) {
    const bs = Date.parse(b.start);
    const be = Date.parse(b.end);
    if (!Number.isFinite(bs) || !Number.isFinite(be)) continue;
    if (startMs < be && bs < endMs) return true;
  }
  return false;
}
