import React, { useState, useEffect } from 'react';
import {
  calculateTaskTimerElapsedMs,
  formatTaskTimerElapsed,
  isTaskTimerLive,
} from '../../utils/taskTimerElapsed';

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
    const active = isTaskTimerLive(task);
    setIsActive(active);

    const updateTimer = () => {
      const workingMs = calculateTaskTimerElapsedMs(task, new Date());
      setElapsedTime(formatTaskTimerElapsed(workingMs));
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
