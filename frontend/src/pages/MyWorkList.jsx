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
    } catch (error) {
      console.error('Error toggling item:', error);
      alert('Failed to update item');
    }
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
            <p className="text-sm text-gray-500">Loading your work list...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">My Work List</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            timeZone: 'America/Chicago'
          })}
          {user?.full_name && <span className="text-gray-400"> &middot; {user.full_name}</span>}
        </p>
      </div>

      {/* Quick-Add */}
      <div className="bg-neutral-50 border border-gray-200 rounded-xl p-4">
        <form onSubmit={handleAddItem} className="flex gap-2">
          <input
            ref={addInputRef}
            type="text"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="What do you need to do today?"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-gray-400 text-sm bg-white"
          />
          <button
            type="submit"
            disabled={!newItemTitle.trim() || addLoading}
            className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {addLoading ? '...' : 'Add'}
          </button>
        </form>
      </div>

      {/* Focus */}
      <div className="bg-neutral-50 border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-sm font-semibold text-gray-700">Today&apos;s Focus</span>
          {focusSaving && <span className="text-[10px] text-gray-400">Saving...</span>}
        </div>
        <input
          type="text"
          value={focusText}
          onChange={(e) => setFocusText(e.target.value)}
          onBlur={() => handleSaveFocus(focusText)}
          placeholder="What's your #1 priority today?"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-gray-400 bg-white"
        />
      </div>

      {/* Progress */}
      {summary && summary.total > 0 && (
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <span className="font-bold">{summary.completed}</span>
              <span className="text-gray-400"> of </span>
              <span className="font-bold">{summary.total}</span>
              <span className="text-gray-400"> done</span>
            </p>
            <div className="flex items-center gap-3">
              <div className="w-20 h-2 bg-white/20 rounded-full overflow-hidden">
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

      {/* Pending Items */}
      {pendingItems.length > 0 && (
        <div className="space-y-1">
          {pendingItems.map(item => (
            <div key={item.id} className="group flex items-center gap-3 bg-neutral-50 border border-gray-200 rounded-lg px-4 py-3 hover:border-primary/30 transition">
              <button
                onClick={() => handleToggleItem(item.id)}
                className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-gray-300 hover:border-primary hover:bg-primary/5 flex items-center justify-center transition"
                title="Mark complete"
              />
              <span className="flex-1 text-sm text-gray-800 min-w-0">
                {item.title}
                {item.description && <span className="text-gray-400 ml-1 text-xs">- {item.description}</span>}
              </span>
              <button
                onClick={() => handleDeleteItem(item.id)}
                className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
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

      {/* Completed Items */}
      {completedItems.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-400 font-medium px-1 mb-1">Completed ({completedItems.length})</p>
          {completedItems.map(item => (
            <div key={item.id} className="group flex items-center gap-3 bg-neutral-50 border border-gray-200 rounded-lg px-4 py-3 opacity-60">
              <button
                onClick={() => handleToggleItem(item.id)}
                className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 border-2 border-green-500 text-white flex items-center justify-center transition"
                title="Mark incomplete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <span className="flex-1 text-sm text-gray-400 line-through min-w-0">{item.title}</span>
              <button
                onClick={() => handleDeleteItem(item.id)}
                className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
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
      {items.length === 0 && (
        <div className="bg-neutral-50 border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="text-gray-400 text-sm mb-1">No tasks for today yet.</p>
          <p className="text-xs text-gray-400">Add your first task above to get started.</p>
        </div>
      )}

    </div>
  );
};

export default MyWorkList;
