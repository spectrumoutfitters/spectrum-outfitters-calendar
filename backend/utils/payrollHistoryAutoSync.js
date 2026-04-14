import db from '../database/db.js';
import { getHoustonDayOfWeek, getTodayInHouston } from './appTimezone.js';
import { syncPayrollHistoryFromFile } from './payrollHistoryRecords.js';

const SETTING_KEY = 'payroll_history_last_auto_sync_date';
const STATUS_KEY = 'payroll_history_last_sync_status';
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

async function getSetting(key) {
  try {
    const row = await db.getAsync('SELECT value FROM app_settings WHERE key = ?', [key]);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function setSetting(key, value) {
  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, value]
  );
}

async function setSyncStatus(status) {
  await setSetting(STATUS_KEY, JSON.stringify(status));
}

export async function readPayrollHistorySyncStatus() {
  const raw = await getSetting(STATUS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function runPayrollHistorySyncNow(reason = 'manual') {
  const nowIso = new Date().toISOString();
  try {
    const result = await syncPayrollHistoryFromFile();
    const status = {
      ok: true,
      reason,
      at: nowIso,
      imported: result.imported || 0,
      total: result.total || 0,
      sourceCount: result.sourceCount || 0,
    };
    await setSyncStatus(status);
    return status;
  } catch (err) {
    const status = {
      ok: false,
      reason,
      at: nowIso,
      error: err?.message || String(err),
    };
    await setSyncStatus(status);
    throw err;
  }
}

/**
 * Runs on Saturdays (Houston) once per day by default.
 * @param {{ force?: boolean }} opts
 */
export async function runPayrollHistoryAutoSyncIfDue(opts = {}) {
  const force = !!opts.force;
  const today = getTodayInHouston();
  const dow = getHoustonDayOfWeek(today); // 6 = Saturday
  if (!force && dow !== 6) {
    return { ran: false, reason: 'not_saturday', today };
  }
  const last = await getSetting(SETTING_KEY);
  if (!force && last === today) {
    return { ran: false, reason: 'already_ran_today', today };
  }
  const result = await runPayrollHistorySyncNow('scheduled_saturday');
  await setSetting(SETTING_KEY, today);
  return { ran: true, today, ...result };
}

export function startPayrollHistoryAutoSyncJob() {
  // Kick once shortly after boot (forced if boot happens on Saturday).
  setTimeout(async () => {
    try {
      const result = await runPayrollHistoryAutoSyncIfDue();
      if (result.ran) {
        console.log(`[payroll-auto-sync] Saturday sync complete: imported=${result.imported}, total=${result.total}, source=${result.sourceCount}`);
      }
    } catch (err) {
      console.warn('[payroll-auto-sync] startup check failed:', err?.message || err);
    }
  }, 10_000);

  // Continue periodic checks while server is online.
  setInterval(async () => {
    try {
      const result = await runPayrollHistoryAutoSyncIfDue();
      if (result.ran) {
        console.log(`[payroll-auto-sync] Saturday sync complete: imported=${result.imported}, total=${result.total}, source=${result.sourceCount}`);
      }
    } catch (err) {
      console.warn('[payroll-auto-sync] periodic check failed:', err?.message || err);
    }
  }, SIX_HOURS_MS);
}

