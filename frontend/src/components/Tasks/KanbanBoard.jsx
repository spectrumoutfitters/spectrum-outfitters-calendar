import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../../utils/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import EmployeeTaskModal from './EmployeeTaskModal';
import CreateTaskForm from './CreateTaskForm';
import { useAuth } from '../../contexts/AuthContext';

const baseColumns = [
  { id: 'todo', title: 'To Do', color: 'bg-gray-200' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-primary-subtle' },
  { id: 'review', title: 'Review', color: 'bg-yellow-200' },
  { id: 'completed', title: 'Completed', color: 'bg-green-200' },
];

const archivedColumn = { id: 'archived', title: 'Archived', color: 'bg-gray-300' };

const SortableTaskCard = ({ task, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Only apply drag listeners to the handle, not the entire card
  const dragHandleProps = {
    ...attributes,
    ...listeners,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard task={task} onClick={onClick} dragHandleProps={dragHandleProps} />
    </div>
  );
};

const DroppableColumn = ({ id, children }) => {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef}>{children}</div>;
};

const KanbanBoard = () => {
  const { isAdmin } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadTasks();
  }, [searchQuery, showArchived]);

  const loadTasks = async () => {
    try {
      const params = {};
      if (showArchived) {
        params.include_archived = 'true';
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      const response = await api.get('/tasks', { params });
      setTasks(response.data.tasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over) return;

    const taskId = active.id;
    const currentTask = tasks.find(t => t.id === taskId);
    
    if (!currentTask) return;

    // Prevent dragging archived tasks
    if (currentTask.is_archived === 1 || currentTask.is_archived === true) {
      return;
    }

    let newStatus = over.id;
    
    // Check if dropped on a column or on another task
    const isColumn = baseColumns.find(col => col.id === over.id) || (showArchived && over.id === 'archived');
    
    if (!isColumn) {
      // If dropped on another task, use that task's status
      const targetTask = tasks.find(t => t.id === over.id);
      if (targetTask) {
        newStatus = targetTask.status;
      } else {
        return;
      }
    }

    // Prevent moving to archived column via drag (archiving should be done via modal)
    if (newStatus === 'archived') {
      return;
    }

    if (currentTask.status === newStatus) return;

    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );

    try {
      await api.put(`/tasks/${taskId}/status`, { status: newStatus });
      await loadTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
      // Revert optimistic update on error
      await loadTasks();
      // Show user-friendly error message
      const errorMessage = error.response?.data?.error || 'Failed to update task status';
      alert(errorMessage);
    }
  };

  const getTasksByStatus = (status) => {
    let filtered;
    
    if (status === 'archived') {
      // For archived column, show all archived tasks regardless of status
      filtered = tasks.filter((task) => task.is_archived === 1);
    } else {
      // For other columns, exclude archived tasks
      filtered = tasks.filter((task) => {
        return task.status === status && (task.is_archived !== 1 && task.is_archived !== true);
      });
    }
    
    if (filter !== 'all') {
      filtered = filtered.filter((task) => task.category === filter);
    }
    
    return filtered;
  };

  const categories = ['PPF', 'Tinting', 'Wraps', 'Maintenance', 'Upfitting', 'Signs', 'Body Work', 'Admin', 'Other'];

  if (loading) {
    return <div className="text-center py-8">Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 md:gap-4">
        <h2 className="text-xl md:text-2xl font-bold">Task Board</h2>
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 md:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-sm md:text-base w-full sm:w-auto"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base w-full sm:w-auto"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {isAdmin && (
            <>
              <label className="flex items-center gap-2 px-3 md:px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm md:text-base whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="rounded"
                />
                <span>Show Archived</span>
              </label>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-3 md:px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition text-sm md:text-base whitespace-nowrap"
              >
                + New Task
              </button>
            </>
          )}
        </div>
      </div>

      {/* Color reference: Priority and status columns */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Priority:</span>
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-l-4" style={{ borderLeftColor: '#EF4444' }} aria-hidden />
              <span className="text-xs md:text-sm text-gray-600">Urgent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-l-4" style={{ borderLeftColor: '#F59E0B' }} aria-hidden />
              <span className="text-xs md:text-sm text-gray-600">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-l-4" style={{ borderLeftColor: '#FCD34D' }} aria-hidden />
              <span className="text-xs md:text-sm text-gray-600">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-l-4" style={{ borderLeftColor: '#10B981' }} aria-hidden />
              <span className="text-xs md:text-sm text-gray-600">Low</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-l-4" style={{ borderLeftColor: '#6B7280' }} aria-hidden />
              <span className="text-xs md:text-sm text-gray-600">None</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-1 border-t border-gray-100">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Column colors:</span>
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            {baseColumns.map((col) => (
              <div key={col.id} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded ${col.color}`} aria-hidden />
                <span className="text-xs md:text-sm text-gray-600">{col.title}</span>
              </div>
            ))}
            {showArchived && (
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded ${archivedColumn.color}`} aria-hidden />
                <span className="text-xs md:text-sm text-gray-600">{archivedColumn.title}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${showArchived ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3 md:gap-4 overflow-x-auto pb-4`}>
          {baseColumns.map((column) => {
            // Archived column is not droppable (archiving done via modal)
            const ColumnWrapper = column.id === 'archived' ? 'div' : DroppableColumn;
            const wrapperProps = column.id === 'archived' ? {} : { id: column.id };
            
            return (
              <ColumnWrapper key={column.id} {...wrapperProps}>
                <div className="bg-gray-50 rounded-lg p-3 md:p-4 min-h-[300px] md:min-h-[400px]" data-column-id={column.id}>
                  <div className={`${column.color} p-2 rounded mb-4`}>
                    <h3 className="font-semibold text-center">
                      {column.title} ({getTasksByStatus(column.id).length})
                    </h3>
                  </div>
                  {column.id === 'archived' ? (
                    // Archived tasks are not sortable/draggable
                    <div className="space-y-2">
                      {getTasksByStatus(column.id).map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={() => setSelectedTask(task)}
                        />
                      ))}
                    </div>
                  ) : (
                    <SortableContext
                      items={getTasksByStatus(column.id).map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {getTasksByStatus(column.id).map((task) => (
                          <SortableTaskCard
                            key={task.id}
                            task={task}
                            onClick={() => setSelectedTask(task)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  )}
                </div>
              </ColumnWrapper>
            );
          })}
          {showArchived && (
            <div>
              <div className="bg-gray-50 rounded-lg p-4 min-h-[400px]">
                <div className={`${archivedColumn.color} p-2 rounded mb-4`}>
                  <h3 className="font-semibold text-center">
                    {archivedColumn.title} ({getTasksByStatus(archivedColumn.id).length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {getTasksByStatus(archivedColumn.id).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => setSelectedTask(task)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DndContext>

      {selectedTask && (
        <>
          {isAdmin ? (
            <TaskModal
              task={selectedTask}
              onClose={() => {
                setSelectedTask(null);
                loadTasks();
              }}
            />
          ) : (
            <EmployeeTaskModal
              task={selectedTask}
              onClose={() => {
                setSelectedTask(null);
                loadTasks();
              }}
            />
          )}
        </>
      )}

      {showCreateForm && (
        <CreateTaskForm
          onClose={() => {
            setShowCreateForm(false);
            loadTasks();
          }}
        />
      )}
    </div>
  );
};

export default KanbanBoard;
