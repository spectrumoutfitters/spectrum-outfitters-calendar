/** Lunch-return matching used by EditTimeEntryModal. Distinct from lunch display pairing. */

const LUNCH_NOTE = 'lunch break';
const DEFAULT_TIME_TOLERANCE_MS = 5 * 60 * 1000;

export function notesLookLikeLunchBreak(notes) {
  return Boolean(notes && String(notes).toLowerCase().includes(LUNCH_NOTE));
}

export function isLunchReturnTimeMatch(
  entry,
  { lunchEntryId, originalReturnIso, toleranceMs = DEFAULT_TIME_TOLERANCE_MS } = {},
) {
  if (!entry || entry.id === lunchEntryId) return false;
  if (!entry.clock_in) return false;
  if (notesLookLikeLunchBreak(entry.notes)) return false;
  const entryTime = new Date(entry.clock_in).getTime();
  const originalReturnTime = new Date(originalReturnIso).getTime();
  if (!Number.isFinite(entryTime) || !Number.isFinite(originalReturnTime)) return false;
  return Math.abs(entryTime - originalReturnTime) < toleranceMs;
}

/**
 * A lunch return must be the next clock-in on the SAME UTC day as lunch-out.
 * Next-day punches must never be treated as the return (would rewrite tomorrow's clock-in).
 */
export function isLunchReturnSameDayCandidate(entry, { lunchEntryId, lunchOutIso } = {}) {
  if (!entry || entry.id === lunchEntryId) return false;
  if (notesLookLikeLunchBreak(entry.notes)) return false;
  if (!entry.clock_in) return false;
  const entryInTime = new Date(entry.clock_in);
  const lunchOutTime = new Date(lunchOutIso);
  if (Number.isNaN(entryInTime.getTime()) || Number.isNaN(lunchOutTime.getTime())) return false;
  const entryDateStr = entryInTime.toISOString().split('T')[0];
  const lunchOutDateStr = lunchOutTime.toISOString().split('T')[0];
  return entryDateStr === lunchOutDateStr && entryInTime > lunchOutTime;
}

export function pickEarliestLunchReturn(entries, opts) {
  return (
    (entries || [])
      .filter((e) => isLunchReturnSameDayCandidate(e, opts))
      .sort((a, b) => new Date(a.clock_in) - new Date(b.clock_in))[0] || null
  );
}
