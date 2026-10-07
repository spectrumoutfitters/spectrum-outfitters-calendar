import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { getTodayInHouston, getWeekEndingSundayHouston } from './appTimezone.js';

/**
 * Break minutes are a deduction from a completed punch.
 * A negative value would add hours the employee was not clocked in for.
 * Missing or non-numeric values deduct nothing.
 */
export function normalizeBreakMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export const calculateHours = (clockIn, clockOut, breakMinutes = 0) => {
  if (!clockOut) return null;

  const start = new Date(clockIn);
  const end = new Date(clockOut);
  const diffMs = end - start;
  const diffMinutes = diffMs / (1000 * 60) - normalizeBreakMinutes(breakMinutes);
  return Math.max(0, diffMinutes / 60);
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

