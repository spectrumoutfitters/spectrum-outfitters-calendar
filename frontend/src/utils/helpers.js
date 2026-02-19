import { format, parseISO, differenceInHours, differenceInMinutes } from 'date-fns';

// Central Time Zone (Houston, Texas)
const CENTRAL_TIMEZONE = 'America/Chicago';

// Helper to get current Central Time Date object
export const getCurrentCentralTime = () => {
  const now = new Date();
  // Use Intl.DateTimeFormat to get Central Time components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CENTRAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value) - 1; // JS months are 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day').value);
  const hour = parseInt(parts.find(p => p.type === 'hour').value);
  const minute = parseInt(parts.find(p => p.type === 'minute').value);
  const second = parseInt(parts.find(p => p.type === 'second').value);
  
  // Create a Date object representing Central Time (but note: JS Date is always UTC internally)
  // We'll use this for date extraction, but for actual time display use formatter
  return new Date(Date.UTC(year, month, day, hour, minute, second));
};

// Helper to get today's date in Central Time (Houston, Texas)
export const getTodayCentralTime = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CENTRAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  
  return `${year}-${month}-${day}`;
};

// Helper to format current time in Central Time
export const getCurrentCentralTimeString = (format12Hour = false) => {
  const now = new Date();
  if (format12Hour) {
    // 12-hour format with AM/PM
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return formatter.format(now);
  } else {
    // 24-hour format
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(now);
  }
};

// Helper to convert UTC date string to Central Time Date object
export const utcToCentralTime = (utcDateString) => {
  if (!utcDateString) return null;
  try {
    const utcDate = parseISO(utcDateString);
    // Use Intl to get Central Time representation
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(utcDate);
    const year = parseInt(parts.find(p => p.type === 'year').value);
    const month = parseInt(parts.find(p => p.type === 'month').value) - 1;
    const day = parseInt(parts.find(p => p.type === 'day').value);
    const hour = parseInt(parts.find(p => p.type === 'hour').value);
    const minute = parseInt(parts.find(p => p.type === 'minute').value);
    const second = parseInt(parts.find(p => p.type === 'second').value);
    
    // Return as UTC Date (for comparison purposes)
    // Note: This represents Central Time but stored as UTC for Date object compatibility
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  } catch (error) {
    console.warn('Error converting UTC to Central Time:', utcDateString, error);
    return null;
  }
};

// Helper to extract date in Central Time from UTC date string
export const extractCentralTimeDate = (utcDateString) => {
  if (!utcDateString) return null;
  try {
    const utcDate = parseISO(utcDateString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const parts = formatter.formatToParts(utcDate);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn('Error extracting Central Time date:', utcDateString, error);
    return utcDateString.split('T')[0];
  }
};

// Helper to parse date string and ensure it's treated as UTC, then displayed in local time
const parseDate = (dateString) => {
  if (!dateString) return null;
  try {
    if (typeof dateString === 'string') {
      // Trim whitespace
      const trimmed = dateString.trim();
      
      // If it's already ISO format with timezone (Z, +, or -), parse it directly
      if (trimmed.includes('T') && (trimmed.includes('Z') || trimmed.includes('+') || trimmed.match(/-\d{2}:\d{2}$/))) {
        return parseISO(trimmed);
      } else if (trimmed.includes('T')) {
        // ISO format without timezone - assume UTC
        // Handle with or without milliseconds
        if (trimmed.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/)) {
          return parseISO(trimmed + 'Z');
        }
      } else if (trimmed.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,3})?$/)) {
        // SQLite DATETIME format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD HH:MM:SS.mmm" (UTC, no timezone)
        // Replace space with T and append Z to indicate UTC
        const utcString = trimmed.replace(' ', 'T') + 'Z';
        return parseISO(utcString);
      } else if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Date only format: "YYYY-MM-DD" - treat as UTC midnight
        return parseISO(trimmed + 'T00:00:00Z');
      }
    }
    // Fallback: try creating a Date object directly (handles Date objects passed in)
    if (dateString instanceof Date) {
      return dateString;
    }
    return new Date(dateString);
  } catch (error) {
    console.warn('Error parsing date:', dateString, error);
    // Final fallback: try creating a Date object
    try {
      return new Date(dateString);
    } catch {
      return null;
    }
  }
};

/** For upcoming events: "Today", "Tomorrow", or "Mon, Feb 17". */
export const getUpcomingDayLabel = (dateString) => {
  if (!dateString || !String(dateString).match(/^\d{4}-\d{2}-\d{2}$/)) return formatDate(dateString) || '';
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(date);
  that.setHours(0, 0, 0, 0);
  const diffDays = Math.round((that - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return formatter.format(date);
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    // If it's a date-only string (YYYY-MM-DD) from backend's extractCentralTimeDate,
    // it's already in Central Time format, so format it directly
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-').map(Number);
      // Format directly without timezone conversion since it's already a Central Time date
      const date = new Date(year, month - 1, day);
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      return formatter.format(date);
    }
    
    // For datetime strings, parse and format normally with timezone conversion
    const utcDate = parseDate(dateString);
    if (!utcDate) return dateString;
    
    // Format in Central Time using Intl API
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    return formatter.format(utcDate);
  } catch (error) {
    console.warn('Error formatting date:', dateString, error);
    return dateString;
  }
};

export const getDueDateColor = (dueDate) => {
  if (!dueDate) return '';
  
  try {
    const due = parseDate(dueDate);
    if (!due) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDateOnly = new Date(due);
    dueDateOnly.setHours(0, 0, 0, 0);
    
    const diffTime = dueDateOnly - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      // Overdue - red
      return 'text-red-600 font-semibold';
    } else if (diffDays === 0) {
      // Due today - orange
      return 'text-orange-600 font-semibold';
    } else if (diffDays <= 2) {
      // Due in 1-2 days - yellow
      return 'text-yellow-600 font-semibold';
    } else if (diffDays <= 7) {
      // Due in 3-7 days - blue
      return 'text-blue-600';
    } else {
      // More than a week away - gray (default)
      return 'text-gray-500';
    }
  } catch {
    return '';
  }
};

export const formatDuration = (minutes) => {
  if (!minutes && minutes !== 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  try {
    const utcDate = parseDate(dateString);
    if (!utcDate) return dateString;
    
    // Format in Central Time using Intl API
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return formatter.format(utcDate);
  } catch {
    return dateString;
  }
};

export const formatTime = (dateString) => {
  if (!dateString) return '—';
  try {
    // Parse UTC date string
    let utcDate;
    if (typeof dateString === 'string') {
      // If it's already ISO format with timezone, parse it directly
      if (dateString.includes('T') && (dateString.includes('Z') || dateString.includes('+') || dateString.includes('-'))) {
        utcDate = parseISO(dateString);
      } else {
        // SQLite DATETIME format: "YYYY-MM-DD HH:MM:SS" (UTC, no timezone)
        // Append 'Z' to indicate UTC, then parse
        const utcString = dateString.replace(' ', 'T') + 'Z';
        utcDate = parseISO(utcString);
      }
    } else {
      utcDate = new Date(dateString);
    }
    
    if (!utcDate || isNaN(utcDate.getTime())) {
      console.warn('Invalid date string for formatTime:', dateString);
      return '—';
    }
    
    // Format in Central Time using Intl API
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return formatter.format(utcDate);
  } catch (error) {
    console.warn('Error formatting time:', dateString, error);
    return '—';
  }
};

export const calculateElapsedTime = (startTime, totalElapsedMs = null) => {
  // If totalElapsedMs is provided (from backend), use that for accurate day total
  if (totalElapsedMs !== null && totalElapsedMs !== undefined) {
    const totalMinutes = Math.floor(totalElapsedMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }
  
  // Fallback to calculating from startTime (for backward compatibility)
  if (!startTime) return '0:00';
  try {
    const start = parseISO(startTime);
    const now = new Date();
    const minutes = differenceInMinutes(now, start);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  } catch {
    return '0:00';
  }
};

// Calculate total duration (including breaks) - raw time from start to completion/review
// This shows how long the task took from start to finish (including all breaks)
export const calculateTotalDuration = (startTime, endTime, status = null) => {
  if (!startTime) return null;
  try {
    const start = parseDate(startTime);
    if (!start) return null;
    
    // For total duration, use completed_at if task is completed or in review
    // Otherwise, if task is still in progress, use current time
    // But if task has a status of 'review' or 'completed', we should use endTime (completed_at)
    let effectiveEndTime = endTime;
    
    // If task is completed or in review, use the completion time
    // Otherwise, if still in progress, use current time
    if (!effectiveEndTime && status && (status === 'completed' || status === 'review')) {
      // Task is done but no completed_at - use current time as fallback
      effectiveEndTime = new Date().toISOString();
    } else if (!effectiveEndTime) {
      // Task is still in progress - use current time
      effectiveEndTime = new Date().toISOString();
    }
    
    const end = parseDate(effectiveEndTime);
    if (!end) return null;
    
    const totalMinutes = differenceInMinutes(end, start);
    
    if (totalMinutes < 0) {
      console.warn('Negative duration detected:', { startTime, endTime, start, end, totalMinutes });
      return null;
    }
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  } catch (error) {
    console.warn('Error calculating total duration:', error, { startTime, endTime });
    return null;
  }
};

// Calculate working time (excluding breaks) - actual time spent working (unpaused time)
export const calculateDuration = (startTime, endTime, breaks = [], activeBreak = null) => {
  if (!startTime) return null;
  try {
    // Use parseDate helper to correctly handle SQLite DATETIME format
    const start = parseDate(startTime);
    if (!start) return null;
    
    // Determine the effective end time for calculation
    // If there's an active break, working time stops at the break start
    // Otherwise, use completed_at or current time
    const now = new Date();
    const effectiveEndTime = activeBreak && activeBreak.break_start 
      ? activeBreak.break_start 
      : (endTime || now.toISOString());
    
    const end = parseDate(effectiveEndTime);
    if (!end) return null;
    
    // Start with total time from start to end
    let totalMinutes = differenceInMinutes(end, start);
    
    // Subtract break time if breaks are provided
    if (breaks && Array.isArray(breaks) && breaks.length > 0) {
      let breakMinutes = 0;
      
      breaks.forEach(breakItem => {
        const breakStart = breakItem.break_start ? parseDate(breakItem.break_start) : null;
        const breakEnd = breakItem.break_end ? parseDate(breakItem.break_end) : null;
        
        if (!breakStart) return; // Skip if no break start time
        
        // Count completed breaks (those with break_end)
        if (breakStart && breakEnd) {
          // For completed breaks, only count the portion that overlaps with task period
          // Clamp break start/end to task period boundaries
          const clampedBreakStart = breakStart < start ? start : breakStart;
          const clampedBreakEnd = breakEnd > end ? end : breakEnd;
          
          // Only count if there's an overlap with the task period
          if (clampedBreakStart < clampedBreakEnd && clampedBreakStart >= start && clampedBreakEnd <= end) {
            const breakDuration = differenceInMinutes(clampedBreakEnd, clampedBreakStart);
            if (breakDuration > 0) {
              breakMinutes += breakDuration;
            }
          }
        }
        // Count active breaks (those without break_end)
        else if (breakStart && !breakEnd) {
          // For active breaks, count from break start to effective end (or current time if still active)
          // Only count if break started after task start
          if (breakStart >= start && breakStart <= end) {
            const activeBreakDuration = differenceInMinutes(end, breakStart);
            if (activeBreakDuration > 0) {
              breakMinutes += activeBreakDuration;
            }
          }
        }
      });
      
      totalMinutes -= breakMinutes;
    }
    
    // Also handle active_break if passed separately (for backward compatibility)
    // This prevents double-counting if active_break is also in the breaks array
    if (activeBreak && activeBreak.break_start && !activeBreak.break_end) {
      // Check if this active break is already in the breaks array
      const alreadyCounted = breaks.some(b => 
        b.break_start === activeBreak.break_start && !b.break_end
      );
      
      if (!alreadyCounted) {
        const breakStart = parseDate(activeBreak.break_start);
        if (breakStart && breakStart >= start && breakStart <= end) {
          const activeBreakDuration = differenceInMinutes(end, breakStart);
          if (activeBreakDuration > 0) {
            totalMinutes -= activeBreakDuration;
          }
        }
      }
    }
    
    // Handle negative durations (shouldn't happen, but protect against it)
    if (totalMinutes < 0) {
      console.warn('Negative duration detected:', { startTime, endTime, start, end, totalMinutes, breaks });
      return null;
    }
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  } catch (error) {
    console.warn('Error calculating duration:', error, { startTime, endTime, breaks, activeBreak });
    return null;
  }
};

// Calculate duration in minutes (for comparison with estimated time)
export const calculateDurationMinutes = (startTime, endTime, breaks = [], activeBreak = null) => {
  if (!startTime) return 0;
  try {
    const start = parseDate(startTime);
    if (!start) return 0;
    
    // Determine the effective end time for calculation
    const now = new Date();
    const effectiveEndTime = activeBreak && activeBreak.break_start 
      ? activeBreak.break_start 
      : (endTime || now.toISOString());
    
    const end = parseDate(effectiveEndTime);
    if (!end) return 0;
    
    // Start with total time from start to end
    let totalMinutes = differenceInMinutes(end, start);
    
    // Subtract break time if breaks are provided
    if (breaks && Array.isArray(breaks) && breaks.length > 0) {
      let breakMinutes = 0;
      
      breaks.forEach(breakItem => {
        const breakStart = breakItem.break_start ? parseDate(breakItem.break_start) : null;
        const breakEnd = breakItem.break_end ? parseDate(breakItem.break_end) : null;
        
        if (!breakStart) return; // Skip if no break start time
        
        // Count completed breaks
        if (breakStart && breakEnd) {
          // Clamp break start/end to task period boundaries
          const clampedBreakStart = breakStart < start ? start : breakStart;
          const clampedBreakEnd = breakEnd > end ? end : breakEnd;
          
          // Only count if there's an overlap with the task period
          if (clampedBreakStart < clampedBreakEnd && clampedBreakStart >= start && clampedBreakEnd <= end) {
            const breakDuration = differenceInMinutes(clampedBreakEnd, clampedBreakStart);
            if (breakDuration > 0) {
              breakMinutes += breakDuration;
            }
          }
        }
        // Count active breaks
        else if (breakStart && !breakEnd) {
          if (breakStart >= start && breakStart <= end) {
            const activeBreakDuration = differenceInMinutes(end, breakStart);
            if (activeBreakDuration > 0) {
              breakMinutes += activeBreakDuration;
            }
          }
        }
      });
      
      totalMinutes -= breakMinutes;
    }
    
    // Also handle active_break if passed separately (prevent double-counting)
    if (activeBreak && activeBreak.break_start && !activeBreak.break_end) {
      const alreadyCounted = breaks.some(b => 
        b.break_start === activeBreak.break_start && !b.break_end
      );
      
      if (!alreadyCounted) {
        const breakStart = parseDate(activeBreak.break_start);
        if (breakStart && breakStart >= start && breakStart <= end) {
          const activeBreakDuration = differenceInMinutes(end, breakStart);
          if (activeBreakDuration > 0) {
            totalMinutes -= activeBreakDuration;
          }
        }
      }
    }
    
    return Math.max(0, totalMinutes);
  } catch (error) {
    console.warn('Error calculating duration in minutes:', error);
    return 0;
  }
};

export const getPriorityColor = (priority) => {
  switch (priority) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
};

export const getCategoryColor = (category) => {
  const colors = {
    'PPF': 'bg-blue-100 text-blue-800',
    'Tinting': 'bg-purple-100 text-purple-800',
    'Wraps': 'bg-pink-100 text-pink-800',
    'Maintenance': 'bg-green-100 text-green-800',
    'Upfitting': 'bg-yellow-100 text-yellow-800',
    'Signs': 'bg-indigo-100 text-indigo-800',
    'Body Work': 'bg-orange-100 text-orange-800',
    'Admin': 'bg-gray-100 text-gray-800',
    'Other': 'bg-gray-100 text-gray-800',
  };
  return colors[category] || colors['Other'];
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'bg-success text-white';
    case 'in_progress': return 'bg-primary text-white';
    case 'review': return 'bg-warning text-white';
    case 'todo': return 'bg-gray-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

export const toTitleCase = (str) => {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

export const handleTitleCaseInput = (e, setValue) => {
  const value = e.target.value;
  // Only apply title case if user is typing (not deleting)
  if (value.length > 0) {
    // Apply title case on blur or when space is pressed
    const words = value.split(' ');
    const titleCased = words.map(word => {
      if (word.length === 0) return word;
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
    setValue(titleCased);
  } else {
    setValue(value);
  }
};


