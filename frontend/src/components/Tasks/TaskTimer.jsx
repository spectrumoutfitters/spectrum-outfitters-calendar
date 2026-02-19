import React, { useState, useEffect } from 'react';

/**
 * Real-time task timer component
 * Displays elapsed working time (excluding breaks) with live updates
 */
const TaskTimer = ({ task, className = '' }) => {
  const [elapsedTime, setElapsedTime] = useState(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!task || !task.started_at) {
      setElapsedTime(null);
      setIsActive(false);
      return;
    }

    // Check if task is active (started but not completed)
    const active = !task.completed_at && task.status !== 'completed' && task.status !== 'review';
    setIsActive(active);

    // Calculate initial elapsed time
    const calculateElapsed = () => {
      if (!task.started_at) return null;

      const startTime = new Date(task.started_at);
      const now = new Date();
      const endTime = task.completed_at ? new Date(task.completed_at) : now;

      // Calculate total elapsed time
      let totalMs = endTime - startTime;

      // Subtract break time
      const breaks = task.breaks || [];
      let breakMs = 0;

      breaks.forEach(breakItem => {
        if (!breakItem.break_start) return;

        const breakStart = new Date(breakItem.break_start);
        const breakEnd = breakItem.break_end
          ? new Date(breakItem.break_end)
          : (task.active_break ? now : null);

        if (breakStart >= startTime && breakStart <= endTime) {
          const breakEndTime = breakEnd || endTime;
          const clampedBreakEnd = breakEndTime > endTime ? endTime : breakEndTime;
          const breakDuration = clampedBreakEnd - breakStart;
          if (breakDuration > 0) {
            breakMs += breakDuration;
          }
        }
      });

      // Handle active break
      if (task.active_break && task.active_break.break_start) {
        const activeBreakStart = new Date(task.active_break.break_start);
        if (activeBreakStart >= startTime && activeBreakStart <= endTime) {
          const activeBreakDuration = endTime - activeBreakStart;
          if (activeBreakDuration > 0) {
            breakMs += activeBreakDuration;
          }
        }
      }

      const workingMs = Math.max(0, totalMs - breakMs);
      return workingMs;
    };

    const updateTimer = () => {
      const workingMs = calculateElapsed();
      if (workingMs === null) {
        setElapsedTime(null);
        return;
      }

      const totalMinutes = Math.floor(workingMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const formatted = `${hours}:${minutes.toString().padStart(2, '0')}`;

      setElapsedTime({
        totalMinutes,
        totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
        formatted,
        totalMs: workingMs
      });
    };

    // Initial calculation
    updateTimer();

    // Update every second if task is active
    let interval = null;
    if (active) {
      interval = setInterval(updateTimer, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [task?.started_at, task?.completed_at, task?.status, task?.breaks, task?.active_break]);

  // Use backend calculated time if available (more accurate)
  if (task?.timeTracking) {
    const timeData = task.timeTracking;
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          <svg
            className={`w-5 h-5 ${isActive ? 'text-green-600 animate-pulse' : 'text-gray-500'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <span className={`text-lg font-semibold ${isActive ? 'text-green-700' : 'text-gray-700'}`}>
              {timeData.formatted}
            </span>
            {isActive && (
              <span className="ml-2 text-xs text-gray-500">(live)</span>
            )}
          </div>
        </div>
        {timeData.totalBreakMinutes > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {timeData.breakCount} pause{timeData.breakCount !== 1 ? 's' : ''} ({Math.floor(timeData.totalBreakMinutes / 60)}:{String(timeData.totalBreakMinutes % 60).padStart(2, '0')})
          </p>
        )}
      </div>
    );
  }

  // Fallback to client-side calculation
  if (!elapsedTime) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <svg
          className={`w-5 h-5 ${isActive ? 'text-green-600 animate-pulse' : 'text-gray-500'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className={`text-lg font-semibold ${isActive ? 'text-green-700' : 'text-gray-700'}`}>
          {elapsedTime.formatted}
        </span>
        {isActive && (
          <span className="ml-2 text-xs text-gray-500">(live)</span>
        )}
      </div>
    </div>
  );
};

export default TaskTimer;
