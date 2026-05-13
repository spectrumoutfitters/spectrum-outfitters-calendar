import { google } from 'googleapis';
import crypto from 'crypto';
import db from '../database/db.js';

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const GOOGLE_BOOKING_SCOPES = [CALENDAR_SCOPE, GMAIL_SEND_SCOPE];

const SCOPES = [...GOOGLE_BOOKING_SCOPES];

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function nowIso() {
  return new Date().toISOString();
}

function toDateOnly(value) {
  if (!value) return null;
  // value could be 'YYYY-MM-DD' or ISO datetime
  if (typeof value === 'string' && value.length >= 10) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function addDaysDateOnly(dateOnly, days) {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getRedirectUri() {
  const port = process.env.PORT || 5000;
  return process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/api/google-calendar/callback`;
}

async function ensureConfigRow() {
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS google_calendar_config (
      id INTEGER PRIMARY KEY,
      access_token TEXT,
      refresh_token TEXT,
      token_expiry TEXT,
      calendar_id TEXT,
      sync_token TEXT,
      last_synced_at TEXT,
      is_connected INTEGER DEFAULT 0
    )`
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO google_calendar_config (id, is_connected, calendar_id) VALUES (1, 0, 'primary')`
  );
  // Add sync_calendar_ids for multi-calendar pull (idempotent)
  try {
    const cols = await db.allAsync(`PRAGMA table_info(google_calendar_config)`);
    const hasSyncCalendarIds = (cols || []).some((c) => c.name === 'sync_calendar_ids');
    if (!hasSyncCalendarIds) {
      await db.runAsync(`ALTER TABLE google_calendar_config ADD COLUMN sync_calendar_ids TEXT`);
    }
    const hasOauthScopes = (cols || []).some((c) => c.name === 'oauth_scopes');
    if (!hasOauthScopes) {
      await db.runAsync(`ALTER TABLE google_calendar_config ADD COLUMN oauth_scopes TEXT`);
    }
  } catch (_) {}
}

async function ensureOauthStateTable() {
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS google_oauth_states (
      state TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      user_id INTEGER
    )`
  );
}

async function ensureScheduleSyncColumns() {
  // Make sync resilient even if migration script hasn't been run yet.
  // (Idempotent: attempts to add missing columns only.)
  try {
    const cols = await db.allAsync(`PRAGMA table_info(schedule_entries)`);
    const names = new Set((cols || []).map((c) => c.name));

    if (!names.has('google_event_id')) {
      await db.runAsync(`ALTER TABLE schedule_entries ADD COLUMN google_event_id TEXT`).catch(() => {});
    }
    if (!names.has('source')) {
      await db.runAsync(`ALTER TABLE schedule_entries ADD COLUMN source TEXT DEFAULT 'app'`).catch(() => {});
    }
    if (!names.has('last_synced_at')) {
      await db.runAsync(`ALTER TABLE schedule_entries ADD COLUMN last_synced_at TEXT`).catch(() => {});
    }
    if (!names.has('organizer_display_name')) {
      await db.runAsync(`ALTER TABLE schedule_entries ADD COLUMN organizer_display_name TEXT`).catch(() => {});
    }
    if (!names.has('location')) {
      await db.runAsync(`ALTER TABLE schedule_entries ADD COLUMN location TEXT`).catch(() => {});
    }
    if (!names.has('source_calendar_id')) {
      await db.runAsync(`ALTER TABLE schedule_entries ADD COLUMN source_calendar_id TEXT`).catch(() => {});
    }

    await db.runAsync(
      `CREATE INDEX IF NOT EXISTS idx_schedule_google_event_id ON schedule_entries(google_event_id)`
    ).catch(() => {});
    await db.runAsync(
      `CREATE INDEX IF NOT EXISTS idx_schedule_source ON schedule_entries(source)`
    ).catch(() => {});
  } catch {
    // If schedule_entries doesn't exist, schedule sync simply won't run.
  }
}

export async function getGoogleCalendarConfig() {
  await ensureConfigRow();
  const row = await db.getAsync(`SELECT * FROM google_calendar_config WHERE id = 1`);
  return row || {
    id: 1,
    is_connected: 0,
    calendar_id: 'primary',
    sync_calendar_ids: null
  };
}

async function updateGoogleCalendarConfig(patch) {
  await ensureConfigRow();
  const fields = Object.keys(patch);
  if (fields.length === 0) return;

  const setSql = fields.map((f) => `${f} = ?`).join(', ');
  const params = fields.map((f) => patch[f]);
  params.push(1);

  await db.runAsync(`UPDATE google_calendar_config SET ${setSql} WHERE id = ?`, params);
}

function getOAuth2Client() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return null;
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
}

export async function isGoogleCalendarConnected() {
  const cfg = await getGoogleCalendarConfig();
  return cfg?.is_connected === 1 && !!cfg?.refresh_token;
}

export async function getAuthUrl({ userId }) {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    throw new Error('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env');
  }

  await ensureOauthStateTable();

  // prune old states (persisted in DB so restarts don't break OAuth)
  const cutoffIso = new Date(Date.now() - OAUTH_STATE_TTL_MS).toISOString();
  await db.runAsync(`DELETE FROM google_oauth_states WHERE created_at < ?`, [cutoffIso]).catch(() => {});

  const state = crypto.randomBytes(24).toString('hex');
  await db.runAsync(
    `INSERT OR REPLACE INTO google_oauth_states (state, created_at, user_id) VALUES (?, ?, ?)`,
    [state, nowIso(), userId || null]
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state
  });

  return { url, state };
}

export async function handleOAuthCallback({ code, state }) {
  if (!code) throw new Error('Missing OAuth code');
  if (!state) throw new Error('Missing OAuth state');

  await ensureOauthStateTable();
  const row = await db.getAsync(`SELECT state, created_at FROM google_oauth_states WHERE state = ?`, [state]);
  if (!row) throw new Error('Invalid or expired OAuth state. Please start the connection flow again.');

  const createdAtMs = new Date(row.created_at).getTime();
  if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > OAUTH_STATE_TTL_MS) {
    await db.runAsync(`DELETE FROM google_oauth_states WHERE state = ?`, [state]).catch(() => {});
    throw new Error('OAuth state expired. Please start the connection flow again.');
  }

  // Consume the state so it can't be replayed
  await db.runAsync(`DELETE FROM google_oauth_states WHERE state = ?`, [state]).catch(() => {});

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    throw new Error('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env');
  }

  const { tokens } = await oauth2Client.getToken(code);
  // Note: refresh_token may only be returned the first time (prompt=consent helps).
  const cfg = await getGoogleCalendarConfig();

  await updateGoogleCalendarConfig({
    access_token: tokens.access_token || cfg.access_token || null,
    refresh_token: tokens.refresh_token || cfg.refresh_token || null,
    token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : cfg.token_expiry || null,
    is_connected: 1,
    // default to primary unless user configured otherwise later
    calendar_id: cfg.calendar_id || 'primary',
    // reset incremental sync on new connection
    sync_token: null,
    last_synced_at: null,
    ...(tokens.scope && typeof tokens.scope === 'string' ? { oauth_scopes: tokens.scope.trim() || null } : {})
  });

  return { connected: true };
}

/** Persist refreshed access tokens from google-auth-library. */
function wireTokenPersistence(oauth2Client) {
  oauth2Client.removeAllListeners('tokens');
  oauth2Client.on('tokens', (tokens) => {
    const patch = {};
    if (tokens.access_token) patch.access_token = tokens.access_token;
    if (tokens.refresh_token) patch.refresh_token = tokens.refresh_token;
    if (tokens.expiry_date) patch.token_expiry = new Date(tokens.expiry_date).toISOString();
    if (Object.keys(patch).length === 0) return;
    updateGoogleCalendarConfig(patch).catch((e) => console.warn('Failed to persist Google tokens:', e?.message || e));
  });
}

async function createAuthedOAuth2Client() {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    throw new Error('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env');
  }

  const cfg = await getGoogleCalendarConfig();
  if (!cfg?.refresh_token) {
    throw new Error('Google Calendar is not connected (missing refresh token).');
  }

  oauth2Client.setCredentials({
    access_token: cfg.access_token || undefined,
    refresh_token: cfg.refresh_token || undefined,
    expiry_date: cfg.token_expiry ? new Date(cfg.token_expiry).getTime() : undefined
  });
  wireTokenPersistence(oauth2Client);

  return { oauth2Client, cfg };
}

async function getAuthedCalendarClient() {
  const { oauth2Client, cfg } = await createAuthedOAuth2Client();
  return {
    calendar: google.calendar({ version: 'v3', auth: oauth2Client }),
    oauth2Client,
    cfg
  };
}

export function hasGmailSendScope(oauthScopes) {
  const s = (oauthScopes || '').toLowerCase();
  return (
    s.includes('gmail.send') ||
    s.includes('auth/gmail.send') ||
    s.includes('https://www.googleapis.com/auth/gmail.send')
  );
}

export async function getGoogleOAuthScopesNormalized() {
  const cfg = await getGoogleCalendarConfig();
  const raw = cfg?.oauth_scopes;
  const list = [];
  if (raw && typeof raw === 'string') {
    raw.split(/\s+/).filter(Boolean).forEach((x) => list.push(x));
  }
  return { raw: typeof raw === 'string' ? raw : null, list, has_gmail_send: hasGmailSendScope(raw || '') };
}

function typeLabel(type) {
  const labels = {
    day_off: 'Day Off',
    time_off_request: 'Time Off Request',
    approved_time_off: 'Approved Time Off',
    out_of_office: 'Out of Office',
    vacation: 'Vacation',
    sick_leave: 'Sick Leave',
    personal_leave: 'Personal Leave',
    training: 'Training',
    meeting: 'Meeting',
    other: 'Other',
    appointment: 'Appointment',
    workshop: 'Workshop',
    conference: 'Conference'
  };
  return labels[type] || type || 'Other';
}

function normalizeText(s) {
  return (s || '').toLowerCase();
}

/** Match user by Google organizer email (case-insensitive). */
async function findUserIdByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  const user = await db.getAsync(
    `SELECT id FROM users WHERE is_active = 1 AND LOWER(TRIM(email)) = ?`,
    [trimmed]
  );
  return user?.id ?? null;
}

async function findUserIdFromEventText(text) {
  if (!text) return null;
  const users = await db.allAsync(`SELECT id, full_name, username, email FROM users WHERE is_active = 1`);
  const haystack = normalizeText(text);

  // Prefer full_name matches, then username, then email in text
  for (const u of users) {
    if (u.full_name && haystack.includes(normalizeText(u.full_name))) return u.id;
  }
  for (const u of users) {
    if (u.username && haystack.includes(normalizeText(u.username))) return u.id;
  }
  for (const u of users) {
    if (u.email && haystack.includes(normalizeText(u.email))) return u.id;
  }
  return null;
}

export function shouldSyncEntryToGoogle(entry) {
  if (!entry) return false;
  if (entry.status === 'pending') return false;
  if (entry.type === 'time_off_request') return false;
  return true;
}

export async function pushEventToGoogle(entry) {
  if (!shouldSyncEntryToGoogle(entry)) return null;
  if (!(await isGoogleCalendarConnected())) return null;

  const { calendar, cfg } = await getAuthedCalendarClient();
  // When entry was created with a specific target (e.g. Outfitters Projects), push there
  const calendarId = entry.push_calendar_id || cfg.calendar_id || 'primary';

  const startDate = toDateOnly(entry.start_date);
  const endDate = toDateOnly(entry.end_date);
  if (!startDate || !endDate) throw new Error('Entry is missing start_date/end_date');

  const isShopWide = entry.is_shop_wide === 1 || entry.is_shop_wide === true;
  const namePart = isShopWide ? 'Shop Closed' : (entry.user_name || 'Unknown');
  const summary = `[SO] ${namePart} - ${typeLabel(entry.type)}${entry.reason ? ` (${entry.reason})` : ''}`;

  const descriptionParts = [];
  if (entry.notes) descriptionParts.push(entry.notes);
  descriptionParts.push(`Source: app`);
  descriptionParts.push(`Entry ID: ${entry.id}`);
  const description = descriptionParts.join('\n');

  const event = {
    summary,
    description,
    start: { date: startDate },
    // Google all-day end.date is exclusive
    end: { date: addDaysDateOnly(endDate, 1) },
    extendedProperties: {
      private: {
        appEntryId: String(entry.id),
        userId: entry.user_id != null ? String(entry.user_id) : '',
        isShopWide: isShopWide ? '1' : '0',
        appLastPushAt: nowIso()
      }
    }
  };
  if (entry.location && typeof entry.location === 'string' && entry.location.trim()) {
    event.location = entry.location.trim();
  }

  if (entry.google_event_id) {
    const updated = await calendar.events.update({
      calendarId,
      eventId: entry.google_event_id,
      requestBody: event
    });
    return { google_event_id: updated.data.id, google_updated_at: updated.data.updated };
  }

  const created = await calendar.events.insert({
    calendarId,
    requestBody: event
  });
  return { google_event_id: created.data.id, google_updated_at: created.data.updated };
}

export async function deleteEventFromGoogle(googleEventId) {
  if (!googleEventId) return;
  if (!(await isGoogleCalendarConnected())) return;

  const { calendar, cfg } = await getAuthedCalendarClient();
  const calendarId = cfg.calendar_id || 'primary';

  await calendar.events.delete({
    calendarId,
    eventId: googleEventId
  });
}

function eventToScheduleDates(ev) {
  if (ev?.start?.date && ev?.end?.date) {
    const start = ev.start.date;
    // end is exclusive for all-day events
    const inclusiveEnd = addDaysDateOnly(ev.end.date, -1);
    return { start_date: start, end_date: inclusiveEnd };
  }

  // Timed event: collapse to date-only range
  const startDt = ev?.start?.dateTime || ev?.start?.date;
  const endDt = ev?.end?.dateTime || ev?.end?.date || startDt;
  const start = toDateOnly(startDt);
  const end = toDateOnly(endDt) || start;
  return { start_date: start, end_date: end };
}

function parseTypeFromSummary(summary) {
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

function isShopClosedEvent(summary, description) {
  const s = normalizeText(summary);
  const d = normalizeText(description);
  return s.includes('shop closed') || d.includes('shop closed');
}

async function upsertEntryFromGoogleEvent(ev, sourceCalendarId = null) {
  if (!ev?.id) return;

  // Deleted/cancelled event -> delete local copy
  if (ev.status === 'cancelled') {
    await db.runAsync(`DELETE FROM schedule_entries WHERE google_event_id = ?`, [ev.id]);
    return;
  }

  const { start_date, end_date } = eventToScheduleDates(ev);
  if (!start_date || !end_date) return;

  const privateProps = ev.extendedProperties?.private || {};
  const appEntryId = privateProps.appEntryId ? parseInt(privateProps.appEntryId, 10) : null;
  const privateUserId = privateProps.userId ? parseInt(privateProps.userId, 10) : null;
  const privateIsShopWide = privateProps.isShopWide === '1';

  const summary = ev.summary || '';
  const description = ev.description || '';

  const inferredShopWide = privateIsShopWide || isShopClosedEvent(summary, description);
  const inferredType = parseTypeFromSummary(summary);

  const organizerEmail = ev.organizer?.email || ev.creator?.email || null;
  const organizerDisplayName = ev.organizer?.displayName || ev.creator?.displayName || null;

  let userId = Number.isFinite(privateUserId) ? privateUserId : null;
  if (!userId && !inferredShopWide) {
    userId = await findUserIdByEmail(organizerEmail);
  }
  if (!userId && !inferredShopWide) {
    userId = await findUserIdFromEventText(`${summary}\n${description}\n${organizerEmail || ''}\n${organizerDisplayName || ''}`);
  }

  const reason = summary || null;
  const notes = description || null;
  const location = (ev.location && typeof ev.location === 'string') ? ev.location.trim() || null : null;

  const displayNameForEntry = userId ? null : (organizerDisplayName || (organizerEmail ? organizerEmail.replace(/@.*$/, '').replace(/\./g, ' ') : null));

  const existingByGoogle = await db.getAsync(
    `SELECT id, source FROM schedule_entries WHERE google_event_id = ? LIMIT 1`,
    [ev.id]
  );

  if (existingByGoogle) {
    await db.runAsync(
      `UPDATE schedule_entries
       SET user_id = ?,
           start_date = ?,
           end_date = ?,
           type = ?,
           status = 'scheduled',
           reason = ?,
           notes = ?,
           location = ?,
           source_calendar_id = ?,
           is_shop_wide = ?,
           organizer_display_name = ?,
           source = COALESCE(source, 'google'),
           last_synced_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        userId,
        start_date,
        end_date,
        inferredType,
        reason,
        notes,
        location,
        sourceCalendarId,
        inferredShopWide ? 1 : 0,
        displayNameForEntry,
        nowIso(),
        existingByGoogle.id
      ]
    );
    return;
  }

  // If Google event was originally created by the app and has appEntryId, link it
  if (Number.isFinite(appEntryId) && appEntryId > 0) {
    const existingById = await db.getAsync(`SELECT id FROM schedule_entries WHERE id = ? LIMIT 1`, [appEntryId]);
    if (existingById) {
      await db.runAsync(
        `UPDATE schedule_entries
         SET google_event_id = ?,
             source_calendar_id = ?,
             last_synced_at = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [ev.id, sourceCalendarId, nowIso(), appEntryId]
      );
      return;
    }
  }

  // Otherwise, create a new schedule entry sourced from Google
  await db.runAsync(
    `INSERT INTO schedule_entries
     (user_id, start_date, end_date, type, status, reason, notes, location, source_calendar_id, created_by, is_shop_wide, google_event_id, source, last_synced_at, organizer_display_name)
     VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, NULL, ?, ?, 'google', ?, ?)`,
    [
      userId,
      start_date,
      end_date,
      inferredType,
      reason,
      notes,
      location,
      sourceCalendarId,
      inferredShopWide ? 1 : 0,
      ev.id,
      nowIso(),
      displayNameForEntry
    ]
  );
}

/** Returns array of calendar IDs to pull from. Uses sync_calendar_ids if set, else single calendar_id. */
function getSyncCalendarIds(cfg) {
  const raw = cfg.sync_calendar_ids;
  if (raw && typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((id) => typeof id === 'string')) {
        return parsed;
      }
    } catch (_) {}
  }
  const single = cfg.calendar_id || 'primary';
  return [single];
}

export async function pullChangesFromGoogle({ fullSync = false } = {}) {
  if (!(await isGoogleCalendarConnected())) return { ran: false, reason: 'not_connected' };

  await ensureScheduleSyncColumns();

  const { calendar, cfg } = await getAuthedCalendarClient();
  const calendarIds = getSyncCalendarIds(cfg);

  // Multiple calendars: always full sync per calendar (we don't store per-calendar sync tokens).
  const useMultiple = calendarIds.length > 1;
  const singleCalendarId = calendarIds[0];
  let syncToken = useMultiple || fullSync ? null : (cfg.sync_token || null);

  const baseParams = {
    maxResults: 2500,
    singleEvents: true,
    showDeleted: true
  };

  let processed = 0;
  let nextSyncToken = null;
  const errors = []; // { calendarId, message } for per-calendar failures

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let i = 0; i < calendarIds.length; i++) {
    const calendarId = calendarIds[i];
    // Small delay between calendars to reduce rate-limit risk when syncing many
    if (i > 0) await delay(200);

    const listParams = {
      ...baseParams,
      calendarId
    };
    if (useMultiple) {
      listParams.timeMin = new Date('2000-01-01T00:00:00.000Z').toISOString();
    } else if (!syncToken) {
      listParams.timeMin = new Date('2000-01-01T00:00:00.000Z').toISOString();
    } else {
      listParams.syncToken = syncToken;
    }

    let pageToken = null;
    try {
      do {
        const resp = await calendar.events.list({
          ...listParams,
          pageToken: pageToken || undefined
        });

        const items = resp.data.items || [];
        for (const ev of items) {
          await upsertEntryFromGoogleEvent(ev, calendarId);
          processed += 1;
        }

        pageToken = resp.data.nextPageToken || null;
        if (calendarIds.length === 1) nextSyncToken = resp.data.nextSyncToken || nextSyncToken;
      } while (pageToken);
    } catch (err) {
      if (calendarIds.length === 1 && err?.code === 410) {
        await updateGoogleCalendarConfig({ sync_token: null });
        return pullChangesFromGoogle({ fullSync: true });
      }
      const msg = err?.message || err?.toString?.() || String(err);
      errors.push({ calendarId, message: msg });
      console.warn(`Google Calendar sync failed for calendar ${calendarId}:`, msg);
      // Continue with other calendars instead of failing the whole sync
    }
  }

  await updateGoogleCalendarConfig({
    sync_token: calendarIds.length === 1 ? (nextSyncToken || cfg.sync_token || null) : null,
    last_synced_at: nowIso()
  });

  return { ran: true, processed, errors: errors.length > 0 ? errors : undefined };
}

export async function disconnectGoogleCalendar() {
  await updateGoogleCalendarConfig({
    access_token: null,
    refresh_token: null,
    token_expiry: null,
    sync_token: null,
    last_synced_at: null,
    is_connected: 0,
    oauth_scopes: null
  });
}

/** Query FreeBusy across multiple calendars (merge busy internally). Returns ISO strings. */
export async function queryCalendarFreeBusy({ calendarIds, timeMinIso, timeMaxIso }) {
  if (!Array.isArray(calendarIds) || calendarIds.length === 0) {
    return { calendars: {}, busyIntervals: [], errors: [] };
  }

  const { calendar } = await getAuthedCalendarClient();
  const resp = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
      items: calendarIds.filter(Boolean).map((id) => ({ id }))
    }
  });

  const calMap = resp.data.calendars || {};
  const merged = [];

  function mergeIntervals(intervals) {
    if (!intervals.length) return [];
    intervals.sort((a, b) => a.start.localeCompare(b.start));
    const out = [{ ...intervals[0] }];
    for (let i = 1; i < intervals.length; i++) {
      const cur = intervals[i];
      const last = out[out.length - 1];
      const lastEndMs = Date.parse(last.end);
      const curStartMs = Date.parse(cur.start);
      const curEndMs = Date.parse(cur.end);
      if (curStartMs <= lastEndMs) {
        if (curEndMs > lastEndMs) last.end = cur.end > last.end ? cur.end : last.end;
      } else {
        out.push({ ...cur });
      }
    }
    return out;
  }

  for (const cid of calendarIds) {
    const b = calMap[cid]?.busy || [];
    for (const slice of b) {
      merged.push({ start: slice.start, end: slice.end });
    }
  }

  const errors = [];
  for (const [cid, v] of Object.entries(calMap)) {
    const err = v?.errors;
    if (err && Array.isArray(err)) {
      for (const e of err) errors.push({ calendarId: cid, domain: e.domain, reason: e.reason });
    }
  }

  return { calendars: calMap, busyIntervals: mergeIntervals(merged), errors };
}

/** Timed Calendar event for customer portal drop-offs. */
export async function insertTimedCalendarBookingEvent({
  calendarId,
  summary,
  description,
  startIso,
  endIso,
  timeZone,
  extendedPrivate = {}
}) {
  const { calendar } = await getAuthedCalendarClient();

  const start = startIso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(startIso)
    ? { dateTime: startIso }
    : { dateTime: startIso, timeZone: timeZone || 'UTC' };
  const end = endIso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(endIso)
    ? { dateTime: endIso }
    : { dateTime: endIso, timeZone: timeZone || 'UTC' };

  const event = {
    summary,
    description: description || '',
    start,
    end,
    extendedProperties: {
      private: {
        bookingSource: 'customer_portal',
        appLastPushAt: nowIso(),
        ...extendedPrivate
      }
    }
  };

  const created = await calendar.events.insert({
    calendarId,
    requestBody: event
  });
  return {
    google_event_id: created.data?.id || null,
    google_html_link: created.data?.htmlLink || null,
    updated: created.data?.updated || null
  };
}

/** Send email as the authenticated Google user (needs gmail.send consent). */
export async function sendMailViaGoogle({ to, subject, text, html }) {
  const recipients = (Array.isArray(to) ? to : [to])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);
  if (!recipients.length) throw new Error('No recipients');
  if (!subject || typeof subject !== 'string') throw new Error('subject is required');

  const { oauth2Client } = await createAuthedOAuth2Client();

  const cfg = await getGoogleCalendarConfig();
  if (!hasGmailSendScope(cfg.oauth_scopes)) {
    throw new Error('Gmail send is not authorized yet. Disconnect and reconnect Google in Admin with Gmail permission.');
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: 'me' }).catch(() => null);
  const fromAddr = profile?.data?.emailAddress;
  if (!fromAddr) {
    throw new Error('Could not resolve sender email from Gmail profile.');
  }

  const boundary = `sobooking_${crypto.randomBytes(12).toString('hex')}`;
  const plain = text || '';

  let bodyMime;
  if (html && String(html).trim()) {
    bodyMime = [
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      '',
      plain,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      '',
      String(html),
      '',
      `--${boundary}--`
    ].join('\r\n');
  } else {
    bodyMime = [
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      '',
      plain
    ].join('\r\n');
  }

  const rawMail = [`From: ${fromAddr}`, `To: ${recipients.join(', ')}`, `Subject: ${subject}`, '', bodyMime].join('\r\n');

  const encoded = Buffer.from(rawMail, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded }
  });

  return { from: fromAddr, recipients };
}

export async function listCalendars() {
  if (!(await isGoogleCalendarConnected())) return [];
  const { calendar } = await getAuthedCalendarClient();
  const resp = await calendar.calendarList.list();
  const items = resp.data.items || [];
  return items.map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: c.primary === true,
    accessRole: c.accessRole
  }));
}

export async function setCalendarId(calendarId) {
  if (!calendarId) throw new Error('calendar_id is required');
  await updateGoogleCalendarConfig({
    calendar_id: calendarId,
    sync_token: null,
    last_synced_at: null
  });
}

/** Set which calendar IDs to pull events from (e.g. Outfitters Projects + Outfitter Events). */
export async function setSyncCalendarIds(calendarIds) {
  if (!Array.isArray(calendarIds)) throw new Error('calendar_ids must be an array');
  const ids = calendarIds.filter((id) => typeof id === 'string' && id.trim());
  await updateGoogleCalendarConfig({
    sync_calendar_ids: ids.length > 0 ? JSON.stringify(ids) : null,
    sync_token: null,
    last_synced_at: null
  });
}

/** Delete all schedule entries that came from Google sync. Returns number deleted. */
export async function clearGoogleSourcedScheduleEntries() {
  // Remove every entry from Google: by google_event_id and by source so we catch all (incl. "Unknown User" ones)
  const result = await db.runAsync(
    `DELETE FROM schedule_entries WHERE google_event_id IS NOT NULL OR source = ?`,
    ['google']
  );
  return result.changes ?? 0;
}

