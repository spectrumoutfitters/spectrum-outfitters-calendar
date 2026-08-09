/**
 * Pure helpers for Admin → Customer booking weekly hours form ↔ API shape.
 * Keys '1'..'7' are Monday..Sunday (ISO weekday numbering used by booking config).
 */

/**
 * Build weekly_hours object from the BookingSettings form fields.
 * Mon–Fri share the same open/close; Sat/Sun are optional.
 * @param {{
 *   monOpen: string,
 *   monClose: string,
 *   satOn: boolean,
 *   sunOn: boolean,
 *   satOpen: string,
 *   satClose: string,
 *   sunOpen: string,
 *   sunClose: string
 * }} form
 */
export function weeklyFromForms({
  monOpen,
  monClose,
  satOn,
  sunOn,
  satOpen,
  satClose,
  sunOpen,
  sunClose,
}) {
  const weekdays = [{ start: monOpen, end: monClose }];
  return {
    '1': weekdays,
    '2': weekdays,
    '3': weekdays,
    '4': weekdays,
    '5': weekdays,
    '6': satOn ? [{ start: satOpen, end: satClose }] : [],
    '7': sunOn ? [{ start: sunOpen, end: sunClose }] : [],
  };
}

/**
 * Hydrate BookingSettings form state from stored weekly_hours.
 * Defaults: Mon–Fri 08:00–17:00; weekend toggles off with 09:00–13:00 placeholders.
 * @param {Record<string, Array<{start?: string, end?: string}>>|null|undefined} weekly
 */
export function hydrateWeekly(weekly) {
  const m = weekly?.['1']?.[0] || { start: '08:00', end: '17:00' };
  const sat = weekly?.['6']?.[0] || null;
  const sun = weekly?.['7']?.[0] || null;
  return {
    monOpen: m.start || '08:00',
    monClose: m.end || '17:00',
    satOn: !!sat,
    satOpen: sat?.start || '09:00',
    satClose: sat?.end || '13:00',
    sunOn: !!sun,
    sunOpen: sun?.start || '09:00',
    sunClose: sun?.end || '13:00',
  };
}

/**
 * Deduplicate calendar IDs while preserving first-seen order.
 * Empty / whitespace-only values are dropped.
 * @param {unknown[]} ids
 * @returns {string[]}
 */
export function uniqCalendarIdsArray(ids) {
  const out = [];
  const seen = new Set();
  for (const raw of ids) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
