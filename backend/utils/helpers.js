import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';

export const calculateHours = (clockIn, clockOut, breakMinutes = 0) => {
  if (!clockOut) return null;
  
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  const diffMs = end - start;
  const diffMinutes = diffMs / (1000 * 60) - breakMinutes;
  return Math.max(0, diffMinutes / 60);
};

export const getWeekEndingDate = (date) => {
  const d = date ? new Date(date) : new Date();
  const weekEnd = endOfWeek(d, { weekStartsOn: 1 }); // Monday as start
  return format(weekEnd, 'yyyy-MM-dd');
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

