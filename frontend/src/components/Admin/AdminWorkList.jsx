import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import WorkListItemDetail from './WorkListItemDetail';

const SUGGESTED_TASKS = {
  admin: [
    { title: 'Review time entries', description: 'Approve or flag employee time clock entries', link_target: '/time' },
    { title: 'Approve time off requests', description: 'Review pending time off and approve or deny', link_target: '/admin?tab=time' },
    { title: 'Review submitted tasks', description: 'Check tasks awaiting your approval', link_target: '/tasks?status=review' },
    { title: 'Check inventory reorders', description: 'Review reorder requests from the shop', link_target: '/admin?tab=inventory' },
    { title: 'Check new item requests', description: 'Items staff requested we don\'t have yet', link_target: '/admin?tab=inventory' },
    { title: 'Review schedule', description: 'Confirm employee schedule for the week', link_target: '/admin?tab=schedule' },
    { title: 'Compliance check', description: 'Review upcoming or overdue compliance items', link_target: '/admin?tab=compliance' },
    { title: 'Quick team sync', description: 'Touch base with the team', link_target: '' },
    { title: 'Follow up on orders', description: 'Check order status and deliveries', link_target: '' }
  ],
  employee: []
};

const AdminWorkList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const addInputRef = useRef(null);

  // Core state
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedItem, setSelectedItem] = useState(null);

  // Quick-add
  const [newItemTitle, setNewItemTitle] = useState('');
  const [addTaskLoading, setAddTaskLoading] = useState(false);
  const [addingSuggestionKey, setAddingSuggestionKey] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Selection mode for bulk actions
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ priority: 'all', category: 'all', status: 'all' });

  // Today's focus
  const [focusText, setFocusText] = useState('');
  const [focusSaving, setFocusSaving] = useState(false);

  // Goals
  const [goals, setGoals] = useState([]);
  const [showGoals, setShowGoals] = useState(true);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalPeriod, setNewGoalPeriod] = useState('week');

  // Template manager
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [newTemplate, setNewTemplate] = useState({
    title: '', description: '', recurrence: 'daily',
    day_of_week: 1, day_of_month: 1, link_target: '',
    sort_order: 0, enabled: true
  });

  // ─── Effects ──────────────────────────────────────────────

  useEffect(() => {
    loadWorklist(selectedDate);
    loadFocus();
    loadGoals();
  }, [selectedDate]);

  // ─── Data Loading ─────────────────────────────────────────

  const loadWorklist = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/worklist/today');
      setData(response.data);
    } catch (error) {
      console.error('Error loading worklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFocus = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get(`/admin/worklist/focus?date=${today}`);
      setFocusText(response.data?.focus_text || '');
    } catch {
      // endpoint may not exist yet
    }
  };

  const loadGoals = async () => {
    try {
      const response = await api.get('/admin/worklist/goals');
      setGoals(response.data?.goals || []);
    } catch {
      // endpoint may not exist yet
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await api.get('/admin/worklist/templates');
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  // ─── Item Handlers ────────────────────────────────────────

  const handleToggleItem = async (itemId) => {
    try {
      await api.post(`/admin/worklist/items/${itemId}/toggle`);
      await loadWorklist();
    } catch (error) {
      console.error('Error toggling item:', error);
      alert('Failed to update item');
    }
  };

  const handleAddManualItem = async (e) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;
    setAddTaskLoading(true);
    try {
      await api.post('/admin/worklist/items', { title: newItemTitle.trim() });
      setNewItemTitle('');
      await loadWorklist();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    } finally {
      setAddTaskLoading(false);
    }
  };

  const handleAddFromSuggestion = async (suggestion, openAfter = false) => {
    const key = suggestion.title;
    setAddingSuggestionKey(key);
    try {
      await api.post('/admin/worklist/items', {
        title: suggestion.title,
        description: suggestion.description || undefined,
        link_target: suggestion.link_target || undefined
      });
      await loadWorklist();
      if (openAfter && suggestion.link_target) {
        handleNavigate(suggestion.link_target);
      }
    } catch (error) {
      console.error('Error adding suggested item:', error);
      alert('Failed to add task');
    } finally {
      setAddingSuggestionKey(null);
    }
  };

  const handleDeleteManualItem = async (itemId) => {
    if (!confirm('Delete this item?')) return;
    try {
      await api.delete(`/admin/worklist/items/${itemId}`);
      await loadWorklist();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const handleNavigate = (linkTarget) => {
    if (!linkTarget) return;
    navigate(linkTarget);
  };

  // ─── Focus Handlers ───────────────────────────────────────

  const handleSaveFocus = useCallback(async (text) => {
    setFocusSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await api.post('/admin/worklist/focus', { date: today, focus_text: text });
    } catch {
      // silent fail if endpoint not ready
    } finally {
      setFocusSaving(false);
    }
  }, []);

  const handleFocusBlur = () => {
    handleSaveFocus(focusText);
  };

  // ─── Goal Handlers ────────────────────────────────────────

  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    try {
      await api.post('/admin/worklist/goals', {
        title: newGoalTitle.trim(),
        period_type: newGoalPeriod
      });
      setNewGoalTitle('');
      setShowGoalForm(false);
      await loadGoals();
    } catch {
      alert('Failed to add goal');
    }
  };

  const handleToggleGoal = async (goalId) => {
    try {
      await api.post(`/admin/worklist/goals/${goalId}/toggle`);
      await loadGoals();
    } catch {
      alert('Failed to update goal');
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('Remove this goal?')) return;
    try {
      await api.delete(`/admin/worklist/goals/${goalId}`);
      await loadGoals();
    } catch {
      alert('Failed to delete goal');
    }
  };

  // ─── Bulk / Selection Handlers ────────────────────────────

  const handleBulkSelect = (itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = (items) => {
    const pendingItems = items.filter(item => !item.is_completed);
    if (selectedItems.size === pendingItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(pendingItems.map(item => item.id)));
    }
  };

  const handleBulkComplete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Mark ${selectedItems.size} item(s) as completed?`)) return;
    try {
      await api.post('/admin/worklist/bulk-complete', { item_ids: Array.from(selectedItems) });
      setSelectedItems(new Set());
      await loadWorklist();
    } catch (error) {
      console.error('Error bulk completing:', error);
      alert('Failed to complete items');
    }
  };

  const handleBulkUpdate = async (priority, category) => {
    if (selectedItems.size === 0) return;
    const updates = {};
    if (priority) updates.priority = priority;
    if (category) updates.category = category;
    if (Object.keys(updates).length === 0) return;
    try {
      await api.post('/admin/worklist/bulk-update', { item_ids: Array.from(selectedItems), ...updates });
      setSelectedItems(new Set());
      setBulkAction(null);
      await loadWorklist();
    } catch (error) {
      console.error('Error bulk updating:', error);
      alert('Failed to update items');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Delete ${selectedItems.size} manual item(s)?`)) return;
    try {
      await api.post('/admin/worklist/bulk-delete', { item_ids: Array.from(selectedItems) });
      setSelectedItems(new Set());
      await loadWorklist();
    } catch (error) {
      console.error('Error bulk deleting:', error);
      alert('Failed to delete items');
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedItems(new Set());
    setBulkAction(null);
  };

  // ─── Helpers ──────────────────────────────────────────────

  const filterItems = (items) => {
    return items.filter(item => {
      if (filters.priority !== 'all' && item.priority !== filters.priority) return false;
      if (filters.category !== 'all' && item.category !== filters.category) return false;
      if (filters.status === 'pending' && item.is_completed === 1) return false;
      if (filters.status === 'completed' && item.is_completed !== 1) return false;
      return true;
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'time_approval': 'Time',
      'task_review': 'Tasks',
      'compliance': 'Compliance',
      'inventory': 'Inventory',
      'general': 'General'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'time_approval': return 'bg-primary-subtle text-primary';
      case 'task_review': return 'bg-purple-100 text-purple-800';
      case 'compliance': return 'bg-green-100 text-green-800';
      case 'inventory': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getDueTimeStatus = (dueTime) => {
    if (!dueTime) return null;
    const now = new Date();
    const [hours, minutes] = dueTime.split(':').map(Number);
    const due = new Date(now);
    due.setHours(hours, minutes, 0, 0);
    const diff = due - now;
    const diffMinutes = diff / (1000 * 60);
    if (diffMinutes < 0) return 'overdue';
    if (diffMinutes < 60) return 'due-soon';
    return 'upcoming';
  };

  const getDayName = (dayNum) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNum] || '';
  };

  // ─── Template Handlers ────────────────────────────────────

  const handleOpenTemplateManager = () => {
    loadTemplates();
    setShowTemplateManager(true);
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTemplate.title.trim()) return;
    try {
      await api.post('/admin/worklist/templates', newTemplate);
      setNewTemplate({ title: '', description: '', recurrence: 'daily', day_of_week: 1, day_of_month: 1, link_target: '', sort_order: 0, enabled: true });
      await loadTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Failed to create template');
    }
  };

  const handleUpdateTemplate = async (id, updates) => {
    try {
      await api.put(`/admin/worklist/templates/${id}`, updates);
      await loadTemplates();
      setEditingTemplate(null);
    } catch (error) {
      console.error('Error updating template:', error);
      alert('Failed to update template');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Delete this template? This will not affect already-generated items.')) return;
    try {
      await api.delete(`/admin/worklist/templates/${id}`);
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  // ─── Render Item ──────────────────────────────────────────

  const renderItem = (item) => {
    const isSelected = selectedItems.has(item.id);
    const dueTimeStatus = item.due_time ? getDueTimeStatus(item.due_time) : null;
    const hasQuickAction = ['unapproved_time_entries', 'tasks_in_review', 'pending_time_off'].includes(item.smart_key);

    return (
      <div
        key={item.id}
        className={`group rounded-lg border transition-all ${
          isSelected && selectMode ? 'ring-2 ring-primary bg-primary/5' : ''
        } ${
          item.is_completed
            ? 'bg-neutral-50 border-gray-200 opacity-75'
            : item.priority === 'urgent'
            ? 'bg-red-50 border-red-300'
            : item.priority === 'high'
            ? 'bg-orange-50/60 border-orange-200'
            : 'bg-neutral-50 border-gray-200 hover:border-primary/30'
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Bulk-select checkbox: only in select mode, only for pending items */}
          {selectMode && !item.is_completed && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleBulkSelect(item.id)}
              className="flex-shrink-0 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
          )}

          {/* Single completion control (circle) */}
          <button
            onClick={() => handleToggleItem(item.id)}
            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              item.is_completed
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 hover:border-primary hover:bg-primary/5'
            }`}
            title={item.is_completed ? 'Mark incomplete' : 'Mark complete'}
          >
            {item.is_completed && (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium text-sm ${item.is_completed ? 'text-gray-400 dark:text-neutral-400 line-through' : 'text-gray-800 dark:text-neutral-100'}`}>
                {item.title}
              </span>
              {item.priority && item.priority !== 'medium' && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityColor(item.priority)}`}>
                  {item.priority}
                </span>
              )}
              {item.category && item.category !== 'general' && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getCategoryColor(item.category)}`}>
                  {getCategoryLabel(item.category)}
                </span>
              )}
              {item.due_time && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  dueTimeStatus === 'overdue' ? 'bg-red-100 text-red-800' :
                  dueTimeStatus === 'due-soon' ? 'bg-orange-100 text-orange-800' :
                  'bg-primary-subtle text-primary'
                }`}>
                  {item.due_time}{dueTimeStatus === 'overdue' ? ' overdue' : ''}
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-gray-500 dark:text-neutral-100 mt-0.5 truncate">{item.description}</p>
            )}
            {item.is_completed && item.completed_by_name && (
              <p className="text-[11px] text-gray-400 dark:text-neutral-400 mt-0.5">
                Completed by {item.completed_by_name} at {formatTime(item.completed_at)}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {hasQuickAction && !item.is_completed && (
              <button
                onClick={() => setSelectedItem(item)}
                className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-xs font-medium"
                title="Quick actions"
              >
                Quick
              </button>
            )}
            <button
              onClick={() => setSelectedItem(item)}
              className="p-1.5 text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
              title="Details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {item.link_target && !item.is_completed && (
              <button
                onClick={() => handleNavigate(item.link_target)}
                className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition"
                title="Open"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            )}
            {item.item_type === 'manual' && (
              <button
                onClick={() => handleDeleteManualItem(item.id)}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Loading ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-neutral-100">Loading work list...</p>
        </div>
      </div>
    );
  }

  // ─── Computed Values ──────────────────────────────────────

  const { summary, templateItems = [], smartItems = [], allItems = [] } = data || {};
  const filteredAll = filterItems(allItems);

  const groupedItems = {};
  filteredAll.forEach(item => {
    const category = item.category || 'general';
    if (!groupedItems[category]) groupedItems[category] = [];
    groupedItems[category].push(item);
  });

  const suggestedTasks = SUGGESTED_TASKS[user?.role === 'admin' ? 'admin' : 'employee'] || [];
  const hasActiveFilters = filters.priority !== 'all' || filters.category !== 'all' || filters.status !== 'all';
  const activeGoals = goals.filter(g => !g.is_completed);
  const completedGoals = goals.filter(g => g.is_completed);

  // ─── Main Render ──────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── 1. Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-neutral-100">Today&apos;s Work List</h2>
          <p className="text-sm text-gray-500 dark:text-neutral-100">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              timeZone: 'America/Chicago'
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenTemplateManager}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
            title="Manage recurring task templates"
          >
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Templates
          </button>
          <button
            onClick={() => loadWorklist()}
            className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── 2. Quick-Add ───────────────────────────────────── */}
      <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 shadow-sm">
        <form onSubmit={handleAddManualItem} className="flex gap-2">
          <input
            ref={addInputRef}
            type="text"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="What do you need to do today?"
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-gray-400 dark:placeholder-neutral-400 text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
          />
          <button
            type="submit"
            disabled={!newItemTitle.trim() || addTaskLoading}
            className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {addTaskLoading ? '...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => setShowSuggestions(!showSuggestions)}
            className={`px-3 py-2.5 rounded-lg border text-sm transition shrink-0 ${
              showSuggestions ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white dark:bg-neutral-950 border-gray-300 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-700'
            }`}
            title="Show suggestions"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>
        </form>
        {showSuggestions && suggestedTasks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs font-medium text-gray-500 dark:text-neutral-100 mb-2">Quick add suggestions</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedTasks.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => handleAddFromSuggestion(s, false)}
                  disabled={addingSuggestionKey !== null}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-neutral-950 text-gray-600 dark:text-neutral-100 hover:bg-primary/10 hover:text-primary border border-gray-200 dark:border-neutral-700 transition disabled:opacity-50"
                >
                  {addingSuggestionKey === s.title ? '...' : `+ ${s.title}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 3. Today's Focus ───────────────────────────────── */}
      <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 shadow-sm dark:shadow-neutral-950/50">
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
          onBlur={handleFocusBlur}
          placeholder="What's your #1 priority today? e.g. Get all time entries approved"
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-gray-400 dark:placeholder-neutral-400 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
        />
      </div>

      {/* ── 4. Progress Summary ────────────────────────────── */}
      {summary && (
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300 dark:text-neutral-100 mb-1">Today&apos;s progress</p>
              <p className="text-lg font-bold text-gray-900 dark:text-neutral-100">
                {summary.completed} <span className="font-normal text-gray-400 dark:text-neutral-400">of</span> {summary.total} <span className="font-normal text-gray-400 dark:text-neutral-400">tasks done</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${summary.progress}%` }}
                />
              </div>
              <span className="text-2xl font-bold text-primary">{summary.progress}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Goals ───────────────────────────────────────── */}
      {(goals.length > 0 || showGoalForm) && (
        <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowGoals(!showGoals)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 transition text-gray-900 dark:text-neutral-100"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span className="text-sm font-semibold text-gray-700 dark:text-neutral-100">
                Goals ({activeGoals.length} active{completedGoals.length > 0 ? `, ${completedGoals.length} done` : ''})
              </span>
            </div>
              <svg className={`w-4 h-4 text-gray-400 dark:text-neutral-400 transition-transform ${showGoals ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showGoals && (
            <div className="px-4 pb-4 space-y-2">
              {activeGoals.map(goal => (
                <div key={goal.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 group">
                  <button
                    onClick={() => handleToggleGoal(goal.id)}
                    className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-primary/40 hover:border-primary flex items-center justify-center transition"
                  />
                  <span className="flex-1 text-sm text-gray-700 dark:text-neutral-100">{goal.title}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    goal.period_type === 'week' ? 'bg-blue-50 text-blue-600' :
                    goal.period_type === 'month' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300' :
                    'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-100'
                  }`}>
                    {goal.period_type === 'week' ? 'This week' : goal.period_type === 'month' ? 'This month' : goal.period_type}
                  </span>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {completedGoals.map(goal => (
                <div key={goal.id} className="flex items-center gap-3 p-2 rounded-lg opacity-60 group">
                  <button
                    onClick={() => handleToggleGoal(goal.id)}
                    className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 border-2 border-green-500 text-white flex items-center justify-center transition"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <span className="flex-1 text-sm text-gray-400 dark:text-neutral-400 line-through">{goal.title}</span>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {showGoalForm ? (
                <form onSubmit={handleAddGoal} className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    placeholder="New goal..."
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                    autoFocus
                  />
                  <select
                    value={newGoalPeriod}
                    onChange={(e) => setNewGoalPeriod(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                  >
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                    <option value="quarter">This quarter</option>
                  </select>
                  <button type="submit" disabled={!newGoalTitle.trim()} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg disabled:opacity-50">Add</button>
                  <button type="button" onClick={() => { setShowGoalForm(false); setNewGoalTitle(''); }} className="px-2 py-1.5 text-sm text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg">Cancel</button>
                </form>
              ) : (
                <button
                  onClick={() => setShowGoalForm(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition pt-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add goal
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Show "Add goals" prompt if no goals exist */}
      {goals.length === 0 && !showGoalForm && (
        <button
          onClick={() => { setShowGoals(true); setShowGoalForm(true); }}
          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-dashed border-gray-300 dark:border-neutral-700 rounded-xl p-4 text-center hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10 transition text-gray-700 dark:text-neutral-100"
        >
          <p className="text-sm text-gray-500 dark:text-neutral-100">Set goals to stay focused on what matters</p>
          <p className="text-xs text-primary mt-1 font-medium">+ Add your first goal</p>
        </button>
      )}

      {/* ── 6. Toolbar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition ${
              selectMode ? 'bg-primary/10 border-primary/30 text-primary font-medium' : 'bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-100 hover:bg-gray-50 dark:hover:bg-neutral-700'
            }`}
          >
            {selectMode ? 'Exit select' : 'Select items'}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition ${
              hasActiveFilters ? 'bg-primary/10 border-primary/30 text-primary font-medium' : 'bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-100 hover:bg-gray-50 dark:hover:bg-neutral-700'
            }`}
          >
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters{hasActiveFilters ? ' (active)' : ''}
          </button>
        </div>
        <span className="text-xs text-gray-400">
          {filteredAll.length} task{filteredAll.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── 7. Bulk Actions Bar ────────────────────────────── */}
      {selectMode && selectedItems.size > 0 && (
        <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-xl p-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700 dark:text-neutral-100">
            {selectedItems.size} selected
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleBulkComplete} className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm">
              Complete
            </button>
            <div className="relative">
              <button
                onClick={() => setBulkAction(bulkAction === 'update' ? null : 'update')}
                className="px-3 py-1.5 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-100 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600 transition text-sm"
              >
                Update
              </button>
              {bulkAction === 'update' && (
                <div className="absolute right-0 mt-1 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg dark:shadow-neutral-950/50 p-3 z-10 min-w-[180px] space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-neutral-100 mb-1">Priority</label>
                    <select onChange={(e) => handleBulkUpdate(e.target.value || undefined, undefined)} className="w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100">
                      <option value="">No change</option>
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-neutral-100 mb-1">Category</label>
                    <select onChange={(e) => handleBulkUpdate(undefined, e.target.value || undefined)} className="w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100">
                      <option value="">No change</option>
                      <option value="time_approval">Time</option>
                      <option value="task_review">Tasks</option>
                      <option value="compliance">Compliance</option>
                      <option value="inventory">Inventory</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm">
              Delete
            </button>
            <button onClick={() => setSelectedItems(new Set())} className="px-3 py-1.5 text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition text-sm">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── 8. Filters (collapsible) ──────────────────────── */}
      {showFilters && (
        <div className="bg-neutral-50 border border-gray-200 rounded-lg p-3 flex flex-wrap gap-3">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-neutral-400 mb-0.5 uppercase tracking-wider">Priority</label>
            <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} className="px-2.5 py-1 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100">
              <option value="all">All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-neutral-400 mb-0.5 uppercase tracking-wider">Category</label>
            <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className="px-2.5 py-1 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100">
              <option value="all">All</option>
              <option value="time_approval">Time</option>
              <option value="task_review">Tasks</option>
              <option value="compliance">Compliance</option>
              <option value="inventory">Inventory</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-neutral-400 mb-0.5 uppercase tracking-wider">Status</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-2.5 py-1 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button onClick={() => setFilters({ priority: 'all', category: 'all', status: 'all' })} className="self-end px-2.5 py-1 text-xs text-primary hover:bg-primary/10 rounded-lg transition">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── 9. Task List by Category ──────────────────────── */}
      {Object.keys(groupedItems).length > 0 ? (
        Object.entries(groupedItems).map(([category, items]) => {
          const pendingItems = items.filter(item => !item.is_completed);
          const completedItems = items.filter(item => item.is_completed);

          return (
            <div key={category} className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(category)}`}>
                    {getCategoryLabel(category)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {pendingItems.length} pending{completedItems.length > 0 ? `, ${completedItems.length} done` : ''}
                  </span>
                </div>
                {selectMode && pendingItems.length > 0 && (
                  <button
                    onClick={() => handleSelectAll(items)}
                    className="text-xs text-primary hover:underline"
                  >
                    {pendingItems.every(item => selectedItems.has(item.id)) ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {pendingItems.map(item => renderItem(item))}
                {completedItems.map(item => renderItem(item))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-8 text-center">
          <p className="text-gray-400 text-sm">No tasks match the current filters.</p>
          {hasActiveFilters && (
            <button onClick={() => setFilters({ priority: 'all', category: 'all', status: 'all' })} className="mt-2 text-xs text-primary hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Detail Modal ───────────────────────────────────── */}
      {selectedItem && (
        <WorkListItemDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdate={() => {
            loadWorklist();
            setSelectedItem(null);
          }}
        />
      )}

      {/* ── Template Manager Modal ─────────────────────────── */}
      {showTemplateManager && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:p-4 safe-area-inset"
          style={{ paddingLeft: 'max(0.5rem, env(safe-area-inset-left))', paddingRight: 'max(0.5rem, env(safe-area-inset-right))', paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          onClick={() => setShowTemplateManager(false)}
        >
          <div
            className="bg-white dark:bg-neutral-950 rounded-t-2xl sm:rounded-xl shadow-xl dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 max-w-3xl w-full max-h-[95dvh] sm:max-h-[90vh] flex flex-col overflow-hidden flex-1 sm:flex-initial min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 bg-white dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-700 px-4 py-3 sm:px-6 sm:py-4 flex justify-between items-center min-h-[3rem]">
              <h2 className="text-lg font-bold text-gray-800 dark:text-neutral-100">Manage Templates</h2>
              <button type="button" onClick={() => setShowTemplateManager(false)} className="min-h-[2.75rem] min-w-[2.75rem] flex items-center justify-center text-gray-400 dark:text-neutral-400 hover:text-gray-600 dark:hover:text-neutral-200 text-xl font-bold rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800" aria-label="Close">
                &times;
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
              <div>
                <h3 className="text-base font-semibold mb-3 text-gray-900 dark:text-neutral-100">Current Templates</h3>
                {templates.length === 0 ? (
                  <p className="text-gray-500 dark:text-neutral-100 text-sm">No templates yet. Add one below to auto-generate tasks.</p>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div key={template.id} className={`p-3 rounded-lg border text-sm ${template.enabled ? 'bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-700' : 'bg-gray-50 dark:bg-neutral-950/60 border-gray-200 dark:border-neutral-700 opacity-60'}`}>
                        {editingTemplate?.id === template.id ? (
                          <div className="space-y-2">
                            <input type="text" value={editingTemplate.title} onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg text-sm" placeholder="Title" />
                            <textarea value={editingTemplate.description || ''} onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg text-sm" placeholder="Description" rows={2} />
                            <div className="flex gap-2 flex-wrap">
                              <select value={editingTemplate.recurrence} onChange={(e) => setEditingTemplate({ ...editingTemplate, recurrence: e.target.value })} className="px-2 py-1.5 border rounded-lg text-sm">
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                              </select>
                              {editingTemplate.recurrence === 'weekly' && (
                                <select value={editingTemplate.day_of_week || 1} onChange={(e) => setEditingTemplate({ ...editingTemplate, day_of_week: parseInt(e.target.value) })} className="px-2 py-1.5 border rounded-lg text-sm">
                                  {[0,1,2,3,4,5,6].map(d => <option key={d} value={d}>{getDayName(d)}</option>)}
                                </select>
                              )}
                              {editingTemplate.recurrence === 'monthly' && (
                                <select value={editingTemplate.day_of_month || 1} onChange={(e) => setEditingTemplate({ ...editingTemplate, day_of_month: parseInt(e.target.value) })} className="px-2 py-1.5 border rounded-lg text-sm">
                                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Day {d}</option>)}
                                </select>
                              )}
                              <input type="text" value={editingTemplate.link_target || ''} onChange={(e) => setEditingTemplate({ ...editingTemplate, link_target: e.target.value })} className="flex-1 px-2 py-1.5 border rounded-lg text-sm" placeholder="Link target" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleUpdateTemplate(template.id, editingTemplate)} className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm">Save</button>
                              <button onClick={() => setEditingTemplate(null)} className="px-3 py-1.5 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-100 rounded-lg text-sm">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-800 dark:text-neutral-100">{template.title}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  template.recurrence === 'daily' ? 'bg-primary-subtle text-primary' :
                                  template.recurrence === 'weekly' ? 'bg-purple-100 text-purple-700' :
                                  'bg-orange-100 text-orange-700'
                                }`}>
                                  {template.recurrence}
                                  {template.recurrence === 'weekly' && ` (${getDayName(template.day_of_week)})`}
                                  {template.recurrence === 'monthly' && ` (Day ${template.day_of_month})`}
                                </span>
                                {!template.enabled && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 dark:bg-neutral-600 text-gray-600 dark:text-neutral-100">Off</span>}
                              </div>
                              {template.description && <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{template.description}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleUpdateTemplate(template.id, { enabled: !template.enabled })} className={`px-2 py-1 rounded text-xs transition ${template.enabled ? 'text-yellow-700 hover:bg-yellow-50' : 'text-green-700 hover:bg-green-50'}`}>
                                {template.enabled ? 'Disable' : 'Enable'}
                              </button>
                              <button onClick={() => setEditingTemplate({ ...template })} className="px-2 py-1 text-gray-600 dark:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded text-xs">Edit</button>
                              <button onClick={() => handleDeleteTemplate(template.id)} className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-xs">Del</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-5">
                <h3 className="text-base font-semibold mb-3 text-gray-900 dark:text-neutral-100">Add New Template</h3>
                <form onSubmit={handleCreateTemplate} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="text" value={newTemplate.title} onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100" placeholder="Task title *" required />
                    <select value={newTemplate.recurrence} onChange={(e) => setNewTemplate({ ...newTemplate, recurrence: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100">
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <textarea value={newTemplate.description} onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 placeholder-gray-500 dark:placeholder-neutral-400" placeholder="Description (optional)" rows={2} />
                  <div className="flex gap-3 flex-wrap">
                    {newTemplate.recurrence === 'weekly' && (
                      <select value={newTemplate.day_of_week} onChange={(e) => setNewTemplate({ ...newTemplate, day_of_week: parseInt(e.target.value) })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        {[0,1,2,3,4,5,6].map(d => <option key={d} value={d}>{getDayName(d)}</option>)}
                      </select>
                    )}
                    {newTemplate.recurrence === 'monthly' && (
                      <select value={newTemplate.day_of_month} onChange={(e) => setNewTemplate({ ...newTemplate, day_of_month: parseInt(e.target.value) })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Day {d}</option>)}
                      </select>
                    )}
                    <input type="text" value={newTemplate.link_target} onChange={(e) => setNewTemplate({ ...newTemplate, link_target: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 placeholder-gray-500 dark:placeholder-neutral-400" placeholder="Link target (e.g. /admin?tab=time)" />
                    <input type="number" value={newTemplate.sort_order} onChange={(e) => setNewTemplate({ ...newTemplate, sort_order: parseInt(e.target.value) || 0 })} className="w-20 px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100" placeholder="Order" />
                  </div>
                  <button type="submit" disabled={!newTemplate.title.trim()} className="min-h-[2.75rem] px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    Create Template
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWorkList;
