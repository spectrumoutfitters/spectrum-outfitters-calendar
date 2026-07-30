/**
 * Pure sanitizers for public customer-booking settings and submit payloads.
 * Kept free of DB / Google imports so unit tests stay lightweight.
 */

export const BOOKING_WEEKLY_HOURS_DEFAULT = JSON.stringify({
  '1': [{ start: '08:00', end: '17:00' }],
  '2': [{ start: '08:00', end: '17:00' }],
  '3': [{ start: '08:00', end: '17:00' }],
  '4': [{ start: '08:00', end: '17:00' }],
  '5': [{ start: '08:00', end: '17:00' }],
  '6': [],
  '7': []
});

export const BOOKING_SERVICES_CHECKLIST_DEFAULT = JSON.stringify([
  { id: 'oil_change', label: 'Oil change' },
  { id: 'state_inspection', label: 'State inspection' },
  { id: 'brakes', label: 'Brakes' },
  { id: 'tires', label: 'Tires' },
  { id: 'diagnostic', label: 'Diagnostics' },
  { id: 'other', label: 'Other (describe in notes)' }
]);

export function parseJsonSafe(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(typeof raw === 'string' ? raw : String(raw));
  } catch (_) {
    return fallback;
  }
}

export function uniqStrings(list) {
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

/**
 * Normalize weekly shop hours JSON. Keys are Luxon weekday numbers (1=Mon … 7=Sun).
 * Invalid day keys / interval shapes are dropped; empty/corrupt input falls back to defaults.
 */
export function sanitizeWeeklyHoursJson(rawStr) {
  const d = parseJsonSafe(rawStr, null);
  if (!d || typeof d !== 'object') return BOOKING_WEEKLY_HOURS_DEFAULT;
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

/**
 * Normalize service checklist entries from admin settings.
 * Drops blank labels, clamps ids/labels, and synthesizes ids when missing.
 */
export function sanitizeServiceChecklist(parsed) {
  if (!Array.isArray(parsed)) return parseJsonSafe(BOOKING_SERVICES_CHECKLIST_DEFAULT, []);
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

/**
 * Normalize notification email lists from settings JSON.
 */
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

/**
 * Normalize vehicles from a public booking submit payload.
 * Caps list length and field lengths; drops empty year/make/model rows.
 */
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
