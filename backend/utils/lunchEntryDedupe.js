/**
 * Detect whether a regular time entry is already represented by a lunch-break
 * entry's pre-lunch work window [lunch.clock_in, lunch.clock_out).
 *
 * Lunch-tagged rows store the morning session (clock-in → leave for lunch).
 * True duplicates start inside that window. Earlier non-overlapping sessions
 * (e.g. 08:00–09:00 when lunch work is 10:00–12:00) must be kept.
 *
 * @param {{ id?: number|string, clock_in?: string }} entry
 * @param {{ id?: number|string, clock_in?: string, clock_out?: string }} lunchEntry
 * @returns {boolean}
 */
export function isDuplicateOfLunchWorkEntry(entry, lunchEntry) {
  if (!entry?.clock_in || !lunchEntry?.clock_in || !lunchEntry?.clock_out) return false;
  if (entry.id != null && lunchEntry.id != null && entry.id === lunchEntry.id) return false;

  const entryIn = new Date(entry.clock_in).getTime();
  const lunchIn = new Date(lunchEntry.clock_in).getTime();
  const lunchOut = new Date(lunchEntry.clock_out).getTime();
  if (!Number.isFinite(entryIn) || !Number.isFinite(lunchIn) || !Number.isFinite(lunchOut)) {
    return false;
  }

  return entryIn >= lunchIn && entryIn < lunchOut;
}
