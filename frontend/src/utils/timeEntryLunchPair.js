/**
 * Pair a work entry with its lunch break for Time Clock display.
 * Employee timesheet uses a single-lunch fallback; admin also picks the
 * closest lunch within 2 hours when several exist.
 * Distinct from backend lunch overtime / duplicate-filter gates (#67/#99).
 */

const PRE_LUNCH_MATCH_MS = 60 * 1000;
const ADMIN_CLOSEST_LUNCH_MS = 2 * 60 * 60 * 1000;

function lunchList(lunchBreaks) {
  return Array.isArray(lunchBreaks) ? lunchBreaks : [];
}

function matchPreLunchWork(entry, breaks) {
  return breaks.find((lunch) => {
    if (!lunch.clockOut || !entry.clock_out) return false;
    const lunchOut = new Date(lunch.clockOut);
    const entryOut = new Date(entry.clock_out);
    return Math.abs(lunchOut - entryOut) < PRE_LUNCH_MATCH_MS;
  });
}

function matchLunchDuringPeriod(entry, breaks, workEntries, index, now) {
  const entryIn = new Date(entry.clock_in);
  const entryOut = entry.clock_out ? new Date(entry.clock_out) : new Date(now);
  const nextEntry = workEntries[index + 1];
  const nextEntryIn = nextEntry ? new Date(nextEntry.clock_in) : entryOut;

  return breaks.find((lunch) => {
    if (!lunch.clockOut) return false;
    const lunchOut = new Date(lunch.clockOut);
    return lunchOut >= entryIn && lunchOut < nextEntryIn;
  });
}

function closestLunchWithinTwoHours(entry, breaks) {
  if (!entry.clock_out) return null;
  const entryOut = new Date(entry.clock_out);
  let closestLunch = null;
  let minDiff = Infinity;
  breaks.forEach((lunch) => {
    if (lunch.clockOut) {
      const lunchOut = new Date(lunch.clockOut);
      const diff = Math.abs(lunchOut - entryOut);
      if (diff < minDiff) {
        minDiff = diff;
        closestLunch = lunch;
      }
    }
  });
  if (minDiff < ADMIN_CLOSEST_LUNCH_MS) return closestLunch;
  return null;
}

/**
 * @param {object} entry
 * @param {Array} lunchBreaks
 * @param {Array} workEntries
 * @param {number} index
 * @param {{ fallback?: 'employee' | 'admin', now?: Date | number | string }} [opts]
 */
export function matchLunchBreak(entry, lunchBreaks, workEntries, index, opts = {}) {
  const breaks = lunchList(lunchBreaks);
  const now = opts.now ?? new Date();
  const fallback = opts.fallback === 'admin' ? 'admin' : 'employee';
  const rows = Array.isArray(workEntries) ? workEntries : [];

  let lunchBreak = entry.isPreLunchWork
    ? matchPreLunchWork(entry, breaks)
    : matchLunchDuringPeriod(entry, breaks, rows, index, now);

  if (lunchBreak) return lunchBreak;

  if (fallback === 'employee') {
    return breaks.length === 1 ? breaks[0] : null;
  }

  if (breaks.length === 1) return breaks[0];
  if (breaks.length > 1) return closestLunchWithinTwoHours(entry, breaks);
  return null;
}

/** Preserves the original ternary; for pre-lunch it reduces to !clock_out. */
export function isTimeEntryStillInProgress(entry, lunchBreak) {
  return entry.isPreLunchWork
    ? (lunchBreak && lunchBreak.clockIn && entry.original_clock_out && !entry.clock_out) || (!entry.clock_out)
    : !entry.clock_out;
}

/** Hide pre-lunch clock_out when it is only the lunch-out stamp. */
export function displayTimeEntryClockOut(entry) {
  return entry.isPreLunchWork && entry.original_clock_out
    ? (entry.clock_out && entry.clock_out !== entry.original_clock_out ? entry.clock_out : null)
    : entry.clock_out;
}
