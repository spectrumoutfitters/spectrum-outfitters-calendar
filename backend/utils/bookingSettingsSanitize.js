/**
 * Pure booking-settings persist/resolve sanitizers (vehicles, checklist, emails,
 * calendar ids, weekly hours). Extracted from customerBookingService — keep
 * behavior identical. Do not import customerBookingService.js from tests
 * (luxon/db/Google side effects). Distinct from submit-field gates and freebusy overlap.
 */

export const DEFAULT_BOOKING_WEEKLY_HOURS = {
  '1': [{ start: '08:00', end: '17:00' }],
  '2': [{ start: '08:00', end: '17:00' }],
  '3': [{ start: '08:00', end: '17:00' }],
  '4': [{ start: '08:00', end: '17:00' }],
  '5': [{ start: '08:00', end: '17:00' }],
  '6': [],
  '7': []
};

export const DEFAULT_BOOKING_WEEKLY_HOURS_JSON = JSON.stringify(DEFAULT_BOOKING_WEEKLY_HOURS);

export const DEFAULT_BOOKING_SERVICES_CHECKLIST = [
  { id: 'oil_change', label: 'Oil change' },
  { id: 'state_inspection', label: 'State inspection' },
  { id: 'brakes', label: 'Brakes' },
  { id: 'tires', label: 'Tires' },
  { id: 'diagnostic', label: 'Diagnostics' },
  { id: 'other', label: 'Other (describe in notes)' }
];

export function parseJsonSafe(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(typeof raw === 'string' ? raw : String(raw));
  } catch (_) {
    return fallback;
  }
}

function uniqStrings(list) {
  const seen = new Set();
  const out = [];
  for (const item of list || []) {
    const s = String(item || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function uniqCalendarIds(ids) {
  const out = [];
  const seen = new Set();
  for (const x of ids || []) {
    const id = typeof x === 'string' ? x.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function calendarIdsFromGoogleCfg(cfg) {
  const raw = cfg?.sync_calendar_ids;
  if (raw && typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string' && item.trim())) {
        return uniqCalendarIds(parsed);
      }
    } catch (_) {}
  }
  return [cfg.calendar_id || 'primary'];
}

export function sanitizeWeeklyHoursJson(rawStr) {
  const d = parseJsonSafe(rawStr, null);
  if (!d || typeof d !== 'object') return DEFAULT_BOOKING_WEEKLY_HOURS_JSON;
  const out = {};
  for (const k of ['1', '2', '3', '4', '5', '6', '7']) {
    const intervals = Array.isArray(d[k]) ? d[k] : [];
    out[k] = [];
    for (const block of intervals) {
      const start = String(block?.start || '').slice(0, 5);
      const end = String(block?.end || '').slice(0, 5);
      if (/^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end)) {
        out[k].push({ start, end });
      }
    }
  }
  return JSON.stringify(out);
}

export function sanitizeServiceChecklist(parsed) {
  if (!Array.isArray(parsed)) return parseJsonSafe(JSON.stringify(DEFAULT_BOOKING_SERVICES_CHECKLIST), []);
  return parsed
    .map((item, idx) => {
      const label = typeof item.label === 'string' ? item.label.trim().slice(0, 120) : '';
      let id =
        typeof item.id === 'string' && item.id.trim()
          ? item.id.trim().slice(0, 64).replace(/\s+/g, '_')
          : `svc_${idx}`;
      if (!label) return null;
      return { id, label };
    })
    .filter(Boolean);
}

export function emailListFromJson(raw) {
  let arr = parseJsonSafe(raw, []);
  if (!Array.isArray(arr)) arr = [];
  const out = [];
  for (const e of arr) {
    const s = String(e || '')
      .trim()
      .toLowerCase();
    if (s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) out.push(s);
  }
  return uniqStrings(out);
}

export function sanitizeVehicleList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (let i = 0; i < raw.length && out.length < 10; i++) {
    const v = raw[i] || {};
    const year = String(v.year ?? '').trim().slice(0, 4);
    const make = String(v.make ?? '').trim().slice(0, 64);
    const model = String(v.model ?? '').trim().slice(0, 64);
    const vin = String(v.vin ?? '').trim().slice(0, 32).toUpperCase();
    const plate = String(v.plate ?? v.license_plate ?? '').trim().slice(0, 16).toUpperCase();
    if (!year && !make && !model) continue;
    out.push({
      ...(year ? { year } : {}),
      ...(make ? { make } : {}),
      ...(model ? { model } : {}),
      ...(vin ? { vin } : {}),
      ...(plate ? { plate } : {})
    });
  }
  return out;
}
