import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const PRIORITIES = [
  { value: 'high', label: 'High', className: 'bg-red-100 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200' },
  { value: 'medium', label: 'Medium', className: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200' },
  { value: 'low', label: 'Low', className: 'bg-gray-100 dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-neutral-400' },
];

function getPriorityClass(priority) {
  const p = PRIORITIES.find((x) => x.value === (priority || 'medium'));
  return p ? p.className : PRIORITIES[1].className;
}

function getPriorityBorderClass(priority) {
  switch (priority || 'medium') {
    case 'high': return 'border-l-4 border-l-red-500 dark:border-l-red-500';
    case 'medium': return 'border-l-4 border-l-amber-500 dark:border-l-amber-500';
    case 'low': return 'border-l-4 border-l-gray-400 dark:border-l-neutral-500';
    default: return 'border-l-4 border-l-amber-500 dark:border-l-amber-500';
  }
}

const SortableWorkItem = ({
  item,
  onToggle,
  onDelete,
  onPriorityChange,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg pl-2 pr-4 py-3 hover:border-primary/30 dark:hover:border-primary/40 transition ${getPriorityBorderClass(item.priority)}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1.5 text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-400 cursor-grab active:cursor-grabbing touch-none"
        title="Drag to reorder"
        aria-label="Drag to reorder"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z"/></svg>
      </button>
      <button
        onClick={() => onToggle(item.id)}
        className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-gray-300 dark:border-neutral-700 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 flex items-center justify-center transition"
        title="Mark complete"
      />
      <span className="flex-1 text-sm text-gray-800 dark:text-neutral-100 min-w-0">
        {item.title}
        {item.description && <span className="text-gray-400 dark:text-neutral-100 ml-1 text-xs">- {item.description}</span>}
      </span>
      <select
        value={item.priority || 'medium'}
        onChange={(e) => onPriorityChange(item.id, e.target.value)}
        className="flex-shrink-0 text-xs rounded border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-200 py-1 px-2 min-w-0"
        title="Priority"
        aria-label="Priority"
      >
        {PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      <button
        onClick={() => onDelete(item.id)}
        className="p-1 text-gray-300 dark:text-neutral-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
        title="Delete"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

const MyWorkList = () => {
  const { user } = useAuth();
  const addInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemPriority, setNewItemPriority] = useState('medium');
  const [addLoading, setAddLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedItems, setArchivedItems] = useState([]);
  const [reorderLoading, setReorderLoading] = useState(false);

  // Focus
  const [focusText, setFocusText] = useState('');
  const [focusSaving, setFocusSaving] = useState(false);

  useEffect(() => {
    loadItems();
    loadFocus();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await api.get('/my-worklist/today');
      setItems(response.data?.items || []);
      setSummary(response.data?.summary || null);
    } catch (error) {
      console.error('Error loading my worklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadArchived = async () => {
    try {
      const response = await api.get('/my-worklist/today', { params: { archived: 1 } });
      setArchivedItems(response.data?.items || []);
    } catch {
      setArchivedItems([]);
    }
  };

  const loadFocus = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get(`/my-worklist/focus?date=${today}`);
      setFocusText(response.data?.focus_text || '');
    } catch {
      // endpoint may not exist yet
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;
    setAddLoading(true);
    try {
      await api.post('/my-worklist/items', {
        title: newItemTitle.trim(),
        priority: newItemPriority,
      });
      setNewItemTitle('');
      await loadItems();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggleItem = async (itemId) => {
    try {
      await api.post(`/my-worklist/items/${itemId}/toggle`);
      await loadItems();
      if (showArchived) await loadArchived();
    } catch (error) {
      console.error('Error toggling item:', error);
      alert('Failed to update item');
    }
  };

  const handleToggleShowArchived = async () => {
    const next = !showArchived;
    setShowArchived(next);
    if (next) await loadArchived();
    else setArchivedItems([]);
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Delete this item?')) return;
    try {
      await api.delete(`/my-worklist/items/${itemId}`);
      await loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const handlePriorityChange = async (itemId, priority) => {
    try {
      await api.put(`/my-worklist/items/${itemId}`, { priority });
      await loadItems();
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pendingItems.findIndex((i) => i.id === active.id);
    const newIndex = pendingItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(pendingItems, oldIndex, newIndex);
    const orderedIds = reordered.map((i) => i.id);
    setReorderLoading(true);
    try {
      const res = await api.patch('/my-worklist/items/reorder', { orderedIds });
      setItems(res.data?.items || []);
    } catch (error) {
      console.error('Error reordering:', error);
      await loadItems();
    } finally {
      setReorderLoading(false);
    }
  };

  const handleSaveFocus = useCallback(async (text) => {
    setFocusSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await api.post('/my-worklist/focus', { date: today, focus_text: text });
    } catch {
      // silent
    } finally {
      setFocusSaving(false);
    }
  }, []);

  const pendingItems = items.filter(i => !i.is_completed);
  const completedItems = items.filter(i => i.is_completed);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-neutral-100">Loading your work list...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-neutral-100">My Work List</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-100">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              timeZone: 'America/Chicago'
            })}
            {user?.full_name && <span className="text-gray-400 dark:text-neutral-100"> &middot; {user.full_name}</span>}
          </p>
          <p className="text-xs text-gray-400 dark:text-neutral-400 mt-0.5">List stays until you check items off. Completed items archive after 24 hours.</p>
        </div>
        <button
          type="button"
          onClick={handleToggleShowArchived}
          className="text-sm text-gray-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary"
        >
          {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
      </div>

      {/* Archived section (when toggled) */}
      {showArchived && (
        <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider mb-2">Archived</h2>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3">Uncheck an item to restore it to your list.</p>
          {archivedItems.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-neutral-100">No archived items.</p>
          ) : (
            <div className="space-y-1">
              {archivedItems.map(item => (
                <div key={item.id} className="group flex items-center gap-3 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg px-4 py-3">
                  <button
                    onClick={() => handleToggleItem(item.id)}
                    className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 border-2 border-green-500 text-white flex items-center justify-center hover:opacity-90"
                    title="Uncheck to restore to list"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <span className="flex-1 text-sm text-gray-500 dark:text-neutral-400 line-through min-w-0">{item.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick-Add (hide when showing archived) */}
      {!showArchived && (
        <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
          <form onSubmit={handleAddItem} className="flex flex-wrap gap-2 items-center">
            <input
              ref={addInputRef}
              type="text"
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder="What do you need to do today?"
              className="flex-1 min-w-[180px] px-4 py-2.5 h-12 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-gray-400 dark:placeholder-neutral-400 text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
            />
            <select
              value={newItemPriority}
              onChange={(e) => setNewItemPriority(e.target.value)}
              className="px-3 py-2.5 h-12 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950 text-gray-700 dark:text-neutral-200 text-sm"
              aria-label="Priority"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!newItemTitle.trim() || addLoading}
              className="px-4 py-2.5 h-12 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {addLoading ? '...' : 'Add'}
            </button>
          </form>
          <p className="text-xs text-gray-400 dark:text-neutral-400 mt-1.5">New tasks are saved in Title Case. Drag rows to reorder by priority.</p>
        </div>
      )}

      {/* Focus (hide when showing archived) */}
      {!showArchived && <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-sm font-semibold text-gray-700 dark:text-neutral-100">Today&apos;s Focus</span>
          {focusSaving && <span className="text-[10px] text-gray-400 dark:text-neutral-400">Saving...</span>}
        </div>
        <input
          type="text"
          value={focusText}
          onChange={(e) => setFocusText(e.target.value)}
          onBlur={() => handleSaveFocus(focusText)}
          placeholder="What's your #1 priority today?"
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-gray-400 dark:placeholder-neutral-400 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
        />
      </div>}

      {/* Progress (hide when showing archived) */}
      {!showArchived && summary && summary.total > 0 && (
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-neutral-800 dark:to-neutral-900 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <span className="font-bold">{summary.completed}</span>
              <span className="text-gray-400 dark:text-neutral-100"> of </span>
              <span className="font-bold">{summary.total}</span>
              <span className="text-gray-400 dark:text-neutral-100"> done</span>
            </p>
            <div className="flex items-center gap-3">
              <div className="w-20 h-2 bg-white/20 dark:bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${summary.progress}%` }}
                />
              </div>
              <span className="text-lg font-bold text-primary">{summary.progress}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Pending Items (hide when showing archived) - sortable by drag */}
      {!showArchived && pendingItems.length > 0 && (
        <div className="space-y-1">
          {reorderLoading && (
            <p className="text-xs text-gray-500 dark:text-neutral-400 px-1">Updating order…</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pendingItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {pendingItems.map((item) => (
                <SortableWorkItem
                  key={item.id}
                  item={item}
                  onToggle={handleToggleItem}
                  onDelete={handleDeleteItem}
                  onPriorityChange={handlePriorityChange}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Completed Items (hide when showing archived) */}
      {!showArchived && completedItems.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-400 dark:text-neutral-400 font-medium px-1 mb-1">Completed ({completedItems.length})</p>
          {completedItems.map(item => (
            <div key={item.id} className={`group flex items-center gap-3 bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg pl-2 pr-4 py-3 opacity-60 ${getPriorityBorderClass(item.priority)}`}>
              <button
                onClick={() => handleToggleItem(item.id)}
                className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 border-2 border-green-500 text-white flex items-center justify-center transition"
                title="Mark incomplete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <span className="flex-1 text-sm text-gray-400 dark:text-neutral-400 line-through min-w-0">{item.title}</span>
              <button
                onClick={() => handleDeleteItem(item.id)}
                className="p-1 text-gray-300 dark:text-neutral-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!showArchived && items.length === 0 && (
        <div className="bg-neutral-50 dark:bg-neutral-950 border border-dashed border-gray-300 dark:border-neutral-700 rounded-xl p-8 text-center">
          <p className="text-gray-400 dark:text-neutral-100 text-sm mb-1">No tasks yet.</p>
          <p className="text-xs text-gray-400 dark:text-neutral-400">Add a task above. List stays until you check items off; completed items archive after 24 hours.</p>
        </div>
      )}

    </div>
  );
};

export default MyWorkList;
