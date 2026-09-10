/**
 * Resolve which Google Calendar an app schedule entry lives on.
 * Push stores the target as push_calendar_id; pull stores the origin as
 * source_calendar_id. Delete/update must use that calendar — cfg.calendar_id
 * (often `primary`) is only a fallback and will 404 for secondary calendars
 * such as Outfitters Events / US Holidays, leaving the Google event in place
 * so the 5-minute poll re-inserts the local row.
 */
export function calendarIdForGoogleEvent(entry, cfg) {
  const fromEntry = String(entry?.push_calendar_id || entry?.source_calendar_id || '').trim();
  if (fromEntry) return fromEntry;
  const fromCfg = String(cfg?.calendar_id || '').trim();
  return fromCfg || 'primary';
}
