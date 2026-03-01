import React from 'react';
import { getPriorityColor, getCategoryColor, formatDate, getDueDateColor } from '../../utils/helpers';

const TaskCard = ({ task, onClick, dragHandleProps }) => {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) {
          onClick();
        }
      }}
      className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-neutral-700 cursor-pointer hover:shadow-lg dark:hover:border-neutral-600 transition border-l-4 relative"
      style={{ 
        borderLeftColor: task.priority === 'urgent' ? '#EF4444' :
                        task.priority === 'high' ? '#F59E0B' :
                        task.priority === 'medium' ? '#FCD34D' :
                        task.priority === 'low' ? '#10B981' : '#6B7280'
      }}
    >
      {/* Drag Handle - high contrast so it's visible in light and dark */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing rounded-md text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200 bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors border border-transparent dark:border-neutral-700"
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="flex-shrink-0"
          >
            <circle cx="4" cy="4" r="1.5" />
            <circle cx="12" cy="4" r="1.5" />
            <circle cx="4" cy="8" r="1.5" />
            <circle cx="12" cy="8" r="1.5" />
            <circle cx="4" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
          </svg>
        </div>
      )}
      <div className="p-4">
      <div className="flex justify-between items-start mb-2 pr-10">
        <h3 className="font-semibold text-gray-800 dark:text-neutral-100 flex-1">{task.title}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(task.category)}`}>
          {task.category}
        </span>
      </div>
      
      {task.description && (
        <p className="text-sm text-gray-600 dark:text-neutral-100 mb-2 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-neutral-400">
        <span>{task.assigned_to_name || 'Unassigned'}</span>
        {task.due_date && (
          <span className={getDueDateColor(task.due_date)}>
            Due: {formatDate(task.due_date)}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 dark:text-neutral-400">
        {task.subtasks && task.subtasks.length > 0 && (
          <span>
            ✓ {task.subtasks.filter(st => st.is_completed === 1).length}/{task.subtasks.length} items
          </span>
        )}
        {task.comments && task.comments.length > 0 && (
          <span>
            💬 {task.comments.length} comment{task.comments.length !== 1 ? 's' : ''}
          </span>
        )}
        {task.status === 'review' && (
          <span className="text-warning font-semibold">⚠️ Needs Review</span>
        )}
        {task.active_break && (
          <span className="text-orange-600 font-semibold flex items-center gap-1">
            ⏸️ On Pause
          </span>
        )}
        {!task.active_break && task.status === 'in_progress' && task.started_at && !task.completed_at && (
          <span className="text-blue-600 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
            Working
          </span>
        )}
      </div>
      </div>
    </div>
  );
};

export default TaskCard;

