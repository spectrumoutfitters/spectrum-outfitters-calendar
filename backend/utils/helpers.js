import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { getTodayInHouston, getWeekEndingSundayHouston } from './appTimezone.js';

/** Official "Go to Lunch" stamps notes with this marker and break_minutes=60 (scheduled duration, not a deduction). */
export function isLunchBreakNotes(notes) {
  return typeof notes === 'string' && notes.toLowerCase().includes('lunch break');
}

/**
 * Break minutes that reduce paid/worked hours.
 * Lunch clock-out stores a 1-hour duration marker; the unpaid lunch gap is the clock-out → return clock-in split.
 * Negative values would inflate hours and are treated as 0.
 */
export function effectiveBreakMinutes(notes, breakMinutes) {
  if (isLunchBreakNotes(notes)) return 0;
  const n = Number(breakMinutes);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

export const calculateHours = (clockIn, clockOut, breakMinutes = 0) => {
  if (!clockOut) return null;

  const start = new Date(clockIn);
  const end = new Date(clockOut);
  const breakMins = Math.max(0, Number(breakMinutes) || 0);
  const diffMs = end - start;
  const diffMinutes = diffMs / (1000 * 60) - breakMins;
  return Math.max(0, diffMinutes / 60);
};

/** Paid/worked hours for a time_entries row (skips lunch duration markers). */
export function hoursWorkedFromEntry(entry) {
  if (!entry?.clock_in || !entry?.clock_out) return 0;
  return calculateHours(entry.clock_in, entry.clock_out, effectiveBreakMinutes(entry.notes, entry.break_minutes)) || 0;
}

/**
 * SQLite expression for break hours that reduce worked time.
 * @param {string} [alias] table alias including trailing usage like 'te' or ''
 */
export function sqlEffectiveBreakHoursExpr(alias = '') {
  const p = alias ? `${alias}.` : '';
  return `CASE
      WHEN ${p}notes IS NOT NULL AND lower(${p}notes) LIKE '%lunch break%' THEN 0
      WHEN COALESCE(${p}break_minutes, 0) < 0 THEN 0
      ELSE COALESCE(${p}break_minutes, 0) / 60.0
    END`;
}

/** Week ending Sunday (for time entries). Uses Houston timezone when no date given. */
export const getWeekEndingDate = (date) => {
  if (!date) return getWeekEndingSundayHouston();
  const dateStr = typeof date === 'string' ? date.slice(0, 10) : format(new Date(date), 'yyyy-MM-dd');
  return getWeekEndingSundayHouston(dateStr);
};

export const sanitizeInput = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
};

export const toTitleCase = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

