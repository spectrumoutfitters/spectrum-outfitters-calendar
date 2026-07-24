import { DateTime } from 'luxon';
import db from '../database/db.js';
import {
  getGoogleCalendarConfig,
  queryCalendarFreeBusy,
  insertTimedCalendarBookingEvent,
  sendMailViaGoogle,
  isGoogleCalendarConnected,
  hasBookingOutboundMailScopes
} from './googleCalendarService.js';

const SETTINGS_DEFAULTS = {
  booking_enabled: '0',
  booking_timezone: 'America/Chicago',
  booking_slot_minutes: '30',
  booking_horizon_days: '21',
  booking_buffer_before_minutes: '0',
  booking_weekly_hours: JSON.stringify({
    '1': [{ start: '08:00', end: '17:00' }],
    '2': [{ start: '08:00', end: '17:00' }],
    '3': [{ start: '08:00', end: '17:00' }],
    '4': [{ start: '08:00', end: '17:00' }],
    '5': [{ start: '08:00', end: '17:00' }],
    '6': [],
    '7': []
  }),
  booking_services_checklist: JSON.stringify([
    { id: 'oil_change', label: 'Oil change' },
    { id: 'state_inspection', label: 'State inspection' },
    { id: 'brakes', label: 'Brakes' },
    { id: 'tires', label: 'Tires' },
    { id: 'diagnostic', label: 'Diagnostics' },
    { id: 'other', label: 'Other (describe in notes)' }
  ]),
  booking_write_calendar_id: '',
  booking_availability_calendar_ids: '',
  booking_notify_emails: JSON.stringify([]),
  booking_intro_text: 'Book a convenient vehicle drop-off time. We will confirm by phone if needed.',
  booking_success_message: 'You are booked! We look forward to seeing you.'
};

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

function uniqCalendarIds(ids) {
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

function calendarIdsFromGoogleCfg(cfg) {
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

async function ensureDefaultSettingsSilently() {
  for (const [key, val] of Object.entries(SETTINGS_DEFAULTS)) {
    await db
      .runAsync(`INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`, [key, val])
      .catch(() => {});
  }
}

async function loadSetting(key) {
  await ensureDefaultSettingsSilently();
  const row = await db.getAsync(`SELECT value FROM app_settings WHERE key = ?`, [key]);
  return row?.value ?? SETTINGS_DEFAULTS[key] ?? '';
}

export async function persistBookingSettings(patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in SETTINGS_DEFAULTS)) continue;
    let stored;
    if (k === 'booking_weekly_hours' && typeof v === 'object' && v !== null) {
      stored = sanitizeWeeklyHoursJson(JSON.stringify(v));
    } else if (k === 'booking_services_checklist' && Array.isArray(v)) {
      stored = JSON.stringify(sanitizeServiceChecklist(v));
    } else if (k === 'booking_notify_emails' && Array.isArray(v)) {
      stored = JSON.stringify(emailListFromJson(JSON.stringify(v)));
    } else if (k === 'booking_availability_calendar_ids' && Array.isArray(v)) {
      stored = JSON.stringify(uniqCalendarIds(v));
    } else if (typeof v === 'boolean') {
      stored = v ? '1' : '0';
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      stored = String(Math.trunc(v));
    } else {
      stored = v == null ? '' : String(v);
    }

    await db.runAsync(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [k, stored]
    );
  }
}

function parseJsonSafe(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(typeof raw === 'string' ? raw : String(raw));
  } catch (_) {
    return fallback;
  }
}

function overlapsInterval(startMs, endMs, intervals) {
  for (const b of intervals || []) {
    const bs = Date.parse(b.start);
    const be = Date.parse(b.end);
    if (!Number.isFinite(bs) || !Number.isFinite(be)) continue;
    if (startMs < be && bs < endMs) return true;
  }
  return false;
}

function sanitizeWeeklyHoursJson(rawStr) {
  const d = parseJsonSafe(rawStr, null);
  if (!d || typeof d !== 'object') return SETTINGS_DEFAULTS.booking_weekly_hours;
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
  if (!Array.isArray(parsed)) return parseJsonSafe(SETTINGS_DEFAULTS.booking_services_checklist, []);
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

function emailListFromJson(raw) {
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

export async function getResolvedBookingConfig() {
  await ensureDefaultSettingsSilently();

  const gcfg = await getGoogleCalendarConfig();
  const slotMinutes = Math.min(480, Math.max(15, parseInt(await loadSetting('booking_slot_minutes'), 10) || 30));
  const horizonDays = Math.min(60, Math.max(1, parseInt(await loadSetting('booking_horizon_days'), 10) || 21));
  const bufferBefore = Math.min(120, Math.max(0, parseInt(await loadSetting('booking_buffer_before_minutes'), 10) || 0));

  let tz = (await loadSetting('booking_timezone')) || SETTINGS_DEFAULTS.booking_timezone;
  try {
    DateTime.now().setZone(tz).toISO();
  } catch {
    tz = 'America/Chicago';
  }

  const weekly_hours_str = sanitizeWeeklyHoursJson(await loadSetting('booking_weekly_hours'));
  const checklist = sanitizeServiceChecklist(parseJsonSafe(await loadSetting('booking_services_checklist'), []));

  const writeCal =
    ((await loadSetting('booking_write_calendar_id')) || '').trim() || gcfg.calendar_id || 'primary';

  let availIds = [];
  const availRaw = (await loadSetting('booking_availability_calendar_ids') || '').trim();
  const parsedAvail = parseJsonSafe(availRaw || '[]', null);
  if (Array.isArray(parsedAvail) && parsedAvail.length > 0) {
    availIds = uniqCalendarIds(parsedAvail.filter((id) => typeof id === 'string'));
  }
  if (availIds.length === 0) {
    availIds = calendarIdsFromGoogleCfg(gcfg);
  }
  availIds = uniqCalendarIds([...availIds, writeCal]);

  return {
    enabled: (await loadSetting('booking_enabled')) === '1',
    timezone: tz,
    slotMinutes,
    horizonDays,
    bufferBeforeMinutes: bufferBefore,
    weekly_hours_json: weekly_hours_str,
    weekly_hours: parseJsonSafe(weekly_hours_str, {}),
    services_checklist: checklist,
    write_calendar_id: writeCal,
    availability_calendar_ids: availIds,
    notify_emails: emailListFromJson(await loadSetting('booking_notify_emails')),
    intro_text: (await loadSetting('booking_intro_text')) || '',
    success_message: (await loadSetting('booking_success_message')) || '',
    google_connected: !!(await isGoogleCalendarConnected()),
    gmail_send_allowed:
      !!(await isGoogleCalendarConnected()) && hasBookingOutboundMailScopes(gcfg.oauth_scopes)
  };
}

export async function getPublicBookingPayload() {
  const cfg = await getResolvedBookingConfig();
  const weekly = parseJsonSafe(cfg.weekly_hours_json, {});
  return {
    enabled: cfg.enabled && cfg.google_connected,
    timezone: cfg.timezone,
    slot_minutes: cfg.slotMinutes,
    horizon_days: cfg.horizonDays,
    weekly_hours: weekly,
    services_checklist: cfg.services_checklist,
    intro_text: cfg.intro_text,
    success_message: cfg.success_message
  };
}

function parseHm(hmStr) {
  const [ah, am] = String(hmStr).split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(ah) || !Number.isFinite(am)) return null;
  return { h: ah, m: am };
}

/**
 * Builds candidate UTC slot ranges from weekly hours configuration.
 * @param {{ timezone: string, horizonDays: number, slotMinutes: number, weeklyHoursObj: object, now?: DateTime }} opts
 *        `now` is optional (tests); defaults to current time in `timezone`.
 */
export function generateCandidateSlotsUtc({ timezone, horizonDays, slotMinutes, weeklyHoursObj, now }) {
  const slots = [];
  const anchor = (now && now.isValid ? now : DateTime.now().setZone(timezone)).startOf('day');

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const date = anchor.plus({ days: dayOffset });
    const dow = date.weekday; // 1 Monday .. 7 Sunday
    const intervals = weeklyHoursObj[String(dow)];
    if (!Array.isArray(intervals) || intervals.length === 0) continue;

    for (const block of intervals) {
      const oh = parseHm(block.start);
      const ch = parseHm(block.end);
      if (!oh || !ch) continue;

      let open = date.set({ hour: oh.h, minute: oh.m, second: 0, millisecond: 0 });
      const close = date.set({ hour: ch.h, minute: ch.m, second: 0, millisecond: 0 });
      if (open >= close) continue;

      while (open.plus({ minutes: slotMinutes }) <= close) {
        const end = open.plus({ minutes: slotMinutes });
        slots.push({
          startMs: open.toUTC().toMillis(),
          endMs: end.toUTC().toMillis(),
          startIso: open.toUTC().toISO(),
          endIso: end.toUTC().toISO()
        });
        open = end;
      }
    }
  }

  slots.sort((a, b) => a.startMs - b.startMs);
  return slots;
}

/**
 * True when the requested start/end exactly matches a weekly-hours candidate slot.
 * Public submit must use this — freebusy alone would allow any empty calendar gap (nights/weekends).
 */
export function isOfferedBookingSlot({ startMs, endMs, candidates }) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return false;
  for (const c of candidates || []) {
    if (c.startMs === startMs && c.endMs === endMs) return true;
  }
  return false;
}

export async function computeAvailableBookingSlots() {
  const cfg = await getResolvedBookingConfig();
  if (!(await isGoogleCalendarConnected())) {
    return { slots: [], reason: 'google_not_connected' };
  }

  const weekly = parseJsonSafe(cfg.weekly_hours_json, {});
  const candidates = generateCandidateSlotsUtc({
    timezone: cfg.timezone,
    horizonDays: cfg.horizonDays,
    slotMinutes: cfg.slotMinutes,
    weeklyHoursObj: weekly
  });

  if (candidates.length === 0) return { slots: [] };

  const first = candidates[0].startIso;
  const last = candidates[candidates.length - 1].endIso;

  const { busyIntervals, errors } = await queryCalendarFreeBusy({
    calendarIds: cfg.availability_calendar_ids,
    timeMinIso: DateTime.fromISO(first, { zone: 'utc' }).minus({ hours: 1 }).toUTC().toISO(),
    timeMaxIso: DateTime.fromISO(last, { zone: 'utc' }).plus({ hours: 1 }).toUTC().toISO()
  });

  const nowMs = Date.now();
  const bufferMs = cfg.bufferBeforeMinutes * 60 * 1000;
  const minStart = nowMs + bufferMs;

  const freeSlots = [];
  for (const c of candidates) {
    if (c.startMs < minStart) continue;
    if (!overlapsInterval(c.startMs, c.endMs, busyIntervals)) {
      freeSlots.push({ slot_start_iso: c.startIso, slot_end_iso: c.endIso });
    }
  }

  // FreeBusy per-calendar errors mean we did not observe that calendar's busy times.
  // Fail closed for listing so we never advertise slots that may already be booked.
  if (errors?.length) {
    return {
      slots: [],
      reason: 'freebusy_incomplete',
      freebusy_errors: errors
    };
  }

  return {
    slots: freeSlots.slice(0, 2000),
    freebusy_errors: undefined
  };
}

function sanitizeVehicleList(raw) {
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

function formatVehiclesHuman(vehicles) {
  if (!vehicles.length) return '—';
  return vehicles.map((v) => [v.year, v.make, v.model].filter(Boolean).join(' ') || '(vehicle)').join('; ');
}

function normalizeSlotFromRequest(slot_start_iso, slotMinutes, tz) {
  const startUtc = DateTime.fromISO(slot_start_iso, { setZone: true });
  if (!startUtc.isValid) return null;
  const start = startUtc.toUTC();
  const end = start.plus({ minutes: slotMinutes });
  return { startISO: start.toISO(), endISO: end.toISO(), startMs: start.toMillis(), endMs: end.toMillis(), tzLocalLabel: tz };
}

export async function submitCustomerBooking(payload) {
  const cfg = await getResolvedBookingConfig();
  if (!cfg.enabled) {
    const err = new Error('Online booking is turned off.');
    err.code = 'disabled';
    throw err;
  }
  if (!(await isGoogleCalendarConnected())) {
    const err = new Error('Booking is unavailable (Google Calendar is not connected).');
    err.code = 'google';
    throw err;
  }

  const gcfg = await getGoogleCalendarConfig();
  const notify = cfg.notify_emails;
  if (!notify.length) {
    const err = new Error('No notification emails are configured. Add staff emails in Admin.');
    err.code = 'notify';
    throw err;
  }

  const name = String(payload.customer_name ?? '')
    .trim()
    .slice(0, 200);
  const phone = String(payload.customer_phone ?? '')
    .replace(/[^\d+()\-\s]/g, '')
    .trim()
    .slice(0, 40);
  const emailPart = String(payload.customer_email ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 200);
  const customer_email =
    emailPart && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPart) ? emailPart : null;

  if (!name || name.length < 2) {
    const err = new Error('Please enter your name.');
    err.code = 'validation';
    throw err;
  }
  if (!phone || phone.replace(/\D/g, '').length < 7) {
    const err = new Error('Please enter a valid phone number.');
    err.code = 'validation';
    throw err;
  }

  const honeypot = String(payload.company_website ?? payload.website ?? '').trim();
  if (honeypot) {
    const err = new Error('Spam blocked.');
    err.code = 'spam';
    throw err;
  }

  const vehicles = sanitizeVehicleList(payload.vehicles);
  const selectedIds = Array.isArray(payload.selected_service_ids)
    ? payload.selected_service_ids.map((x) => String(x)).filter(Boolean).slice(0, 40)
    : [];

  const notes = String(payload.notes ?? '').trim().slice(0, 4000);

  const slotNorm = normalizeSlotFromRequest(payload.slot_start_iso, cfg.slotMinutes, cfg.timezone);
  if (!slotNorm) {
    const err = new Error('Pick a valid time slot.');
    err.code = 'validation';
    throw err;
  }

  const weekly = parseJsonSafe(cfg.weekly_hours_json, {});
  const offered = generateCandidateSlotsUtc({
    timezone: cfg.timezone,
    horizonDays: cfg.horizonDays,
    slotMinutes: cfg.slotMinutes,
    weeklyHoursObj: weekly
  });
  if (!isOfferedBookingSlot({ startMs: slotNorm.startMs, endMs: slotNorm.endMs, candidates: offered })) {
    const err = new Error('That time is outside bookable shop hours. Please choose a listed slot.');
    err.code = 'validation';
    throw err;
  }

  const nowMs = Date.now();
  const bufferMs = cfg.bufferBeforeMinutes * 60 * 1000;
  if (slotNorm.startMs < nowMs + bufferMs) {
    const err = new Error('That slot is no longer available. Please choose a later time.');
    err.code = 'conflict';
    throw err;
  }

  const checklistById = new Map(cfg.services_checklist.map((x) => [x.id, x.label]));
  const selectedLabels = selectedIds.map((id) => checklistById.get(id) || id).filter(Boolean);

  const fb = await queryCalendarFreeBusy({
    calendarIds: cfg.availability_calendar_ids,
    timeMinIso: DateTime.fromMillis(slotNorm.startMs - 5 * 60 * 1000).toUTC().toISO(),
    timeMaxIso: DateTime.fromMillis(slotNorm.endMs + 5 * 60 * 1000).toUTC().toISO()
  });
  if (fb.errors?.length) {
    const err = new Error(
      'Could not verify calendar availability. Please try again in a few minutes, or call the shop.'
    );
    err.code = 'google';
    throw err;
  }
  if (overlapsInterval(slotNorm.startMs, slotNorm.endMs, fb.busyIntervals)) {
    const err = new Error('That slot was just taken. Please choose another.');
    err.code = 'conflict';
    throw err;
  }

  const vehiclesLine = formatVehiclesHuman(vehicles);
  const svcLine =
    selectedLabels.length > 0 ? selectedLabels.join(', ') + (notes ? ` — Notes: ${notes}` : '') : notes || '—';

  const summary = `[SO Drop-off] ${name}`;
  const descLines = [
    `Spectrum Outfitters — customer-booked vehicle drop-off`,
    `Name: ${name}`,
    `Phone: ${phone}`,
    customer_email ? `Email: ${customer_email}` : '',
    `Vehicles: ${vehiclesLine}`,
    ``,
    `Services / requests:`,
    svcLine,
    ``,
    `Slot (${cfg.timezone}): ${payload.slot_start_iso}`
  ].filter((x) => x !== '');

  let google_event_id = null;

  try {
    const inserted = await insertTimedCalendarBookingEvent({
      calendarId: cfg.write_calendar_id,
      summary,
      description: descLines.join('\n'),
      startIso: slotNorm.startISO,
      endIso: slotNorm.endISO,
      timeZone: 'UTC',
      extendedPrivate: {
        portalCustomerPhone: phone,
        ...(customer_email ? { portalCustomerEmail: customer_email } : {})
      }
    });
    google_event_id = inserted.google_event_id || null;
  } catch (e) {
    const err = new Error(e?.message || 'Could not create calendar event.');
    err.code = 'google_insert';
    err.cause = e;
    throw err;
  }

  const insertResult = await db.runAsync(
    `INSERT INTO customer_bookings
     (customer_name, customer_phone, customer_email, vehicles_json, selected_services_json,
      notes, slot_start_iso, slot_end_iso, timezone, google_event_id, google_write_calendar_id,
      notify_emails_json, email_sent, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'confirmed')`,
    [
      name,
      phone,
      customer_email,
      JSON.stringify(vehicles),
      JSON.stringify(selectedIds),
      notes,
      slotNorm.startISO,
      slotNorm.endISO,
      cfg.timezone,
      google_event_id,
      cfg.write_calendar_id,
      JSON.stringify(notify)
    ]
  );
  const bookingId = insertResult?.lastID;

  const localWhen = slotNorm.startISO ? DateTime.fromISO(slotNorm.startISO, { zone: 'utc' }).setZone(cfg.timezone).toLocaleString(DateTime.DATETIME_FULL) : payload.slot_start_iso;

  let email_error = null;
  let sent = false;
  if (!hasBookingOutboundMailScopes(gcfg.oauth_scopes)) {
    email_error =
      'Gmail send or account-email permission missing — disconnect and reconnect Google in Admin.';
  } else {
    try {
      const subject = `[SO Booking] Drop-off scheduled — ${name}`;
      const text = [
        `New customer vehicle booking`,
        ``,
        `When: ${localWhen}`,
        ``,
        `Name: ${name}`,
        `Phone: ${phone}`,
        customer_email ? `Email: ${customer_email}` : null,
        `Vehicles: ${vehiclesLine}`,
        ``,
        `Services checked / notes:`,
        svcLine,
        ``,
        `Google event ID: ${google_event_id || '—'}`
      ]
        .filter(Boolean)
        .join('\n');

      const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5">
<h2>New drop-off booked</h2>
<p><strong>When:</strong> ${escapeHtml(localWhen)}</p>
<p><strong>Name:</strong> ${escapeHtml(name)}</p>
<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
${customer_email ? `<p><strong>Email:</strong> ${escapeHtml(customer_email)}</p>` : ''}
<p><strong>Vehicles:</strong> ${escapeHtml(vehiclesLine)}</p>
<hr/>
<pre style="white-space:pre-wrap">${escapeHtml(svcLine)}</pre>
<p style="color:#64748b;font-size:13px;">Event: ${escapeHtml(String(google_event_id || ''))}</p>
</div>`;

      await sendMailViaGoogle({ to: notify, subject, text, html });
      sent = true;
    } catch (e) {
      email_error = e?.message || String(e);
      console.warn('Booking email notify failed:', email_error);
    }
  }

  await db.runAsync(`UPDATE customer_bookings SET email_sent = ?, email_error = ? WHERE id = ?`, [
    sent ? 1 : 0,
    email_error,
    bookingId
  ]);

  return {
    ok: true,
    booking_id: bookingId,
    google_event_id,
    confirmation_message: cfg.success_message,
    email_notify_sent: sent,
    email_notify_error: email_error
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function getAdminBookingSnapshot() {
  const cfg = await getResolvedBookingConfig();
  const gcfg = await getGoogleCalendarConfig();
  return {
    ...cfg,
    raw_settings_defaults: SETTINGS_DEFAULTS,
    google_primary_calendar_id: gcfg.calendar_id || 'primary',
    google_calendar_list_hint: uniqCalendarIds(calendarIdsFromGoogleCfg(gcfg)),
    gmail_send_allowed:
      !!(await isGoogleCalendarConnected()) && hasBookingOutboundMailScopes(gcfg.oauth_scopes)
  };
}
