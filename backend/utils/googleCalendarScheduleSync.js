/**
 * Pure Google Calendar ↔ schedule date / classification helpers.
 * Kept free of googleapis/DB so unit tests need no heavy deps.
 */

export function normalizeText(s) {
  return (s || '').toLowerCase();
}

export function toDateOnly(value) {
  if (!value) return null;
  // value could be 'YYYY-MM-DD' or ISO datetime
  if (typeof value === 'string' && value.length >= 10) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function addDaysDateOnly(dateOnly, days) {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Google all-day end.date is exclusive — convert event ↔ inclusive schedule dates. */
export function eventToScheduleDates(ev) {
  if (ev?.start?.date && ev?.end?.date) {
    const start = ev.start.date;
    const inclusiveEnd = addDaysDateOnly(ev.end.date, -1);
    return { start_date: start, end_date: inclusiveEnd };
  }

  const startDt = ev?.start?.dateTime || ev?.start?.date;
  const endDt = ev?.end?.dateTime || ev?.end?.date || startDt;
  const start = toDateOnly(startDt);
  const end = toDateOnly(endDt) || start;
  return { start_date: start, end_date: end };
}

export function parseTypeFromSummary(summary) {
  const s = normalizeText(summary);
  if (s.includes('vacation')) return 'vacation';
  if (s.includes('sick')) return 'sick_leave';
  if (s.includes('personal')) return 'personal_leave';
  if (s.includes('training')) return 'training';
  if (s.includes('meeting')) return 'meeting';
  if (s.includes('out of office') || s.includes('ooo')) return 'out_of_office';
  if (s.includes('approved time off')) return 'approved_time_off';
  if (s.includes('day off')) return 'day_off';
  return 'other';
}

export function isShopClosedEvent(summary, description) {
  const s = normalizeText(summary);
  const d = normalizeText(description);
  return s.includes('shop closed') || d.includes('shop closed');
}

export function shouldSyncEntryToGoogle(entry) {
  if (!entry) return false;
  if (entry.status === 'pending') return false;
  if (entry.type === 'time_off_request') return false;
  return true;
}
