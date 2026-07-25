import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { getTodayInHouston, getWeekEndingSundayHouston } from './appTimezone.js';

/** Lunch is unpaid via separate clock-out/in punches; stored break_minutes must not reduce hours. */
export const isLunchBreakNotes = (notes) =>
  typeof notes === 'string' && notes.toLowerCase().includes('lunch break');

/**
 * Break minutes that reduce paid hours.
 * Clamps negatives (which would otherwise inflate hours) and zeros lunch-break rows.
 */
export const effectiveBreakMinutes = (breakMinutes, notes) => {
  if (isLunchBreakNotes(notes)) return 0;
  const n = Number(breakMinutes);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
};

export const calculateHours = (clockIn, clockOut, breakMinutes = 0) => {
  if (!clockOut) return null;

  const start = new Date(clockIn);
  const end = new Date(clockOut);
  const safeBreak = effectiveBreakMinutes(breakMinutes, null);
  const diffMs = end - start;
  const diffMinutes = diffMs / (1000 * 60) - safeBreak;
  return Math.max(0, diffMinutes / 60);
};

/** Paid hours for a time_entries row, including lunch-break semantics. */
export const calculateEntryHours = (entry) => {
  if (!entry?.clock_out) return null;
  return calculateHours(
    entry.clock_in,
    entry.clock_out,
    effectiveBreakMinutes(entry.break_minutes, entry.notes)
  );
};

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

