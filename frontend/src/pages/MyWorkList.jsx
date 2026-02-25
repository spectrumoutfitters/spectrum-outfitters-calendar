import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const MyWorkList = () => {
  const { user } = useAuth();
  const addInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedItems, setArchivedItems] = useState([]);

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
      await api.post('/my-worklist/items', { title: newItemTitle.trim() });
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
            <p className="text-sm text-gray-500 dark:text-neutral-200">Loading your work list...</p>
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
          <p className="text-sm text-gray-500 dark:text-neutral-200">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              timeZone: 'America/Chicago'
            })}
            {user?.full_name && <span className="text-gray-400 dark:text-neutral-300"> &middot; {user.full_name}</span>}
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
        <div className="bg-neutral-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
          <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider mb-2">Archived</h2>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3">Uncheck an item to restore it to your list.</p>
          {archivedItems.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-neutral-200">No archived items.</p>
          ) : (
            <div className="space-y-1">
              {archivedItems.map(item => (
                <div key={item.id} className="group flex items-center gap-3 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-4 py-3">
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
      {!showArchived && <div className="bg-neutral-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
        <form onSubmit={handleAddItem} className="flex gap-2">
          <input
            ref={addInputRef}
            type="text"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="What do you need to do today?"
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-gray-400 dark:placeholder-neutral-400 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
          />
          <button
            type="submit"
            disabled={!newItemTitle.trim() || addLoading}
            className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {addLoading ? '...' : 'Add'}
          </button>
        </form>
      </div>}

      {/* Focus (hide when showing archived) */}
      {!showArchived && <div className="bg-neutral-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
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
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-gray-400 dark:placeholder-neutral-400 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
        />
      </div>}

      {/* Progress (hide when showing archived) */}
      {!showArchived && summary && summary.total > 0 && (
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-neutral-800 dark:to-neutral-900 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <span className="font-bold">{summary.completed}</span>
              <span className="text-gray-400 dark:text-neutral-300"> of </span>
              <span className="font-bold">{summary.total}</span>
              <span className="text-gray-400 dark:text-neutral-300"> done</span>
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

      {/* Pending Items (hide when showing archived) */}
      {!showArchived && pendingItems.length > 0 && (
        <div className="space-y-1">
          {pendingItems.map(item => (
            <div key={item.id} className="group flex items-center gap-3 bg-neutral-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg px-4 py-3 hover:border-primary/30 dark:hover:border-primary/40 transition">
              <button
                onClick={() => handleToggleItem(item.id)}
                className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-gray-300 dark:border-neutral-600 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 flex items-center justify-center transition"
                title="Mark complete"
              />
              <span className="flex-1 text-sm text-gray-800 dark:text-neutral-100 min-w-0">
                {item.title}
                {item.description && <span className="text-gray-400 dark:text-neutral-300 ml-1 text-xs">- {item.description}</span>}
              </span>
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

      {/* Completed Items (hide when showing archived) */}
      {!showArchived && completedItems.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-400 dark:text-neutral-400 font-medium px-1 mb-1">Completed ({completedItems.length})</p>
          {completedItems.map(item => (
            <div key={item.id} className="group flex items-center gap-3 bg-neutral-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg px-4 py-3 opacity-60">
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
        <div className="bg-neutral-50 dark:bg-neutral-900 border border-dashed border-gray-300 dark:border-neutral-700 rounded-xl p-8 text-center">
          <p className="text-gray-400 dark:text-neutral-300 text-sm mb-1">No tasks yet.</p>
          <p className="text-xs text-gray-400 dark:text-neutral-400">Add a task above. List stays until you check items off; completed items archive after 24 hours.</p>
        </div>
      )}

    </div>
  );
};

export default MyWorkList;
