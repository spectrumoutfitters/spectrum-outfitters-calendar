/**
 * Task Time Tracking Utilities
 * Provides robust time calculation for tasks, accounting for breaks and edge cases
 */

/**
 * Calculate total working time for a task (excluding breaks)
 * @param {Object} task - Task object with started_at, completed_at, breaks
 * @returns {Object} Time tracking data with minutes, hours, formatted strings
 */
export function calculateTaskWorkingTime(task) {
  if (!task || !task.started_at) {
    return {
      totalMinutes: 0,
      totalHours: 0,
      formatted: '0:00',
      formattedLong: '0 minutes',
      isActive: false
    };
  }

  const startTime = new Date(task.started_at);
  const now = new Date();
  
  // Determine end time
  const endTime = task.completed_at 
    ? new Date(task.completed_at)
    : (task.status === 'completed' || task.status === 'review' ? now : now);
  
  // If task is completed, use completed_at; otherwise use current time
  const effectiveEndTime = task.completed_at ? new Date(task.completed_at) : now;
  
  // Calculate total elapsed time in milliseconds
  let totalMs = effectiveEndTime - startTime;
  
  // Subtract all break time
  const breaks = task.breaks || [];
  let breakMs = 0;
  
  breaks.forEach(breakItem => {
    if (!breakItem.break_start) return;
    
    const breakStart = new Date(breakItem.break_start);
    const breakEnd = breakItem.break_end 
      ? new Date(breakItem.break_end)
      : (task.active_break ? now : null);
    
    // Only count breaks that overlap with task time
    if (breakStart >= startTime && breakStart <= effectiveEndTime) {
      const breakEndTime = breakEnd || effectiveEndTime;
      // Clamp break end to task end time
      const clampedBreakEnd = breakEndTime > effectiveEndTime ? effectiveEndTime : breakEndTime;
      const breakDuration = clampedBreakEnd - breakStart;
      if (breakDuration > 0) {
        breakMs += breakDuration;
      }
    }
  });
  
  // Handle active break if present
  if (task.active_break && task.active_break.break_start) {
    const activeBreakStart = new Date(task.active_break.break_start);
    if (activeBreakStart >= startTime && activeBreakStart <= effectiveEndTime) {
      const activeBreakDuration = effectiveEndTime - activeBreakStart;
      if (activeBreakDuration > 0) {
        breakMs += activeBreakDuration;
      }
    }
  }
  
  // Calculate working time (total - breaks)
  const workingMs = Math.max(0, totalMs - breakMs);
  const totalMinutes = Math.floor(workingMs / (1000 * 60));
  const totalHours = totalMinutes / 60;
  
  // Format time
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const formatted = `${hours}:${minutes.toString().padStart(2, '0')}`;
  
  let formattedLong;
  if (totalMinutes === 0) {
    formattedLong = '0 minutes';
  } else if (totalMinutes < 60) {
    formattedLong = `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
  } else {
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (mins === 0) {
      formattedLong = `${hrs} hour${hrs !== 1 ? 's' : ''}`;
    } else {
      formattedLong = `${hrs} hour${hrs !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
    }
  }
  
  return {
    totalMinutes,
    totalHours: parseFloat(totalHours.toFixed(2)),
    totalMs: workingMs,
    formatted,
    formattedLong,
    isActive: !task.completed_at && task.started_at,
    startTime: task.started_at,
    endTime: task.completed_at || null,
    breakCount: breaks.filter(b => b.break_end).length,
    totalBreakMinutes: Math.floor(breakMs / (1000 * 60))
  };
}

/**
 * Calculate total duration (including breaks) - wall clock time
 * @param {Object} task - Task object
 * @returns {Object} Duration data
 */
export function calculateTaskTotalDuration(task) {
  if (!task || !task.started_at) {
    return {
      totalMinutes: 0,
      formatted: '0:00',
      formattedLong: '0 minutes'
    };
  }

  const startTime = new Date(task.started_at);
  const endTime = task.completed_at 
    ? new Date(task.completed_at)
    : new Date();
  
  const totalMs = endTime - startTime;
  const totalMinutes = Math.floor(totalMs / (1000 * 60));
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const formatted = `${hours}:${minutes.toString().padStart(2, '0')}`;
  
  let formattedLong;
  if (totalMinutes === 0) {
    formattedLong = '0 minutes';
  } else if (totalMinutes < 60) {
    formattedLong = `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
  } else {
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (mins === 0) {
      formattedLong = `${hrs} hour${hrs !== 1 ? 's' : ''}`;
    } else {
      formattedLong = `${hrs} hour${hrs !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
    }
  }
  
  return {
    totalMinutes,
    totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
    formatted,
    formattedLong
  };
}

/**
 * Get real-time elapsed time for an active task
 * @param {Object} task - Task object
 * @returns {Object} Current elapsed time data
 */
export function getCurrentElapsedTime(task) {
  if (!task || !task.started_at || task.completed_at) {
    return null;
  }
  
  const workingTime = calculateTaskWorkingTime(task);
  
  return {
    ...workingTime,
    isLive: true,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Format duration in minutes to human-readable string
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration
 */
export function formatDuration(minutes) {
  if (!minutes || minutes < 0) return '0 minutes';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  }
  
  if (mins === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  
  return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
}

/**
 * Format duration to HH:MM format
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted as HH:MM
 */
export function formatDurationHHMM(minutes) {
  if (!minutes || minutes < 0) return '0:00';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}
