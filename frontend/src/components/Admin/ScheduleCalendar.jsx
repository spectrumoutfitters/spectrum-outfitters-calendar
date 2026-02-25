import React, { useState, useEffect, useCallback } from 'react';
import { DndContext, useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import GoogleCalendarSettings from './GoogleCalendarSettings';

function addDaysDateOnly(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function KanbanCard({ entry, colorClass, onView, isGoogleSourced, typeLabel }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onClick={() => onView(entry)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onView(entry); }}
      className={`rounded-lg p-3 shadow-sm border border-neutral-200 dark:border-neutral-700 cursor-grab active:cursor-grabbing text-left min-h-[4rem] ${colorClass} ${isDragging ? 'opacity-60 shadow-lg' : 'hover:opacity-95'}`}
    >
      <div className="font-semibold text-sm flex items-center gap-1">
        {entry.is_shop_wide ? '🏪 Shop Closed' : (entry.user_name || 'Unknown')}
        {isGoogleSourced(entry) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 dark:bg-black/30 border border-white/80">G</span>}
      </div>
      <div className="text-xs mt-0.5 opacity-90">{entry.reason || typeLabel}</div>
    </div>
  );
}

function KanbanColumn({ dateStr, dateLabel, isToday, entries, getEntryColor, onView, isGoogleSourced, getTypeLabel }) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-[200px] max-w-[200px] flex-shrink-0 rounded-xl border-2 p-3 min-h-[320px] ${isOver ? 'border-primary bg-primary/5 dark:bg-amber-500/10' : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50'} ${isToday ? 'ring-2 ring-primary dark:ring-amber-500' : ''}`}
    >
      <div className={`font-semibold text-sm mb-3 pb-2 border-b border-neutral-200 dark:border-neutral-600 ${isToday ? 'text-primary dark:text-amber-400' : 'text-gray-700 dark:text-neutral-300'}`}>
        {dateLabel}
      </div>
      <div className="space-y-2">
        {entries.map((entry) => (
          <KanbanCard
            key={entry.id}
            entry={entry}
            colorClass={getEntryColor(entry)}
            onView={onView}
            isGoogleSourced={isGoogleSourced}
            typeLabel={getTypeLabel(entry.type)}
          />
        ))}
      </div>
    </div>
  );
}

const ScheduleCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [calendarNames, setCalendarNames] = useState({});
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' = drag to move; 'month' = grid
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [employeesSeeAll, setEmployeesSeeAll] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [reschedulingId, setReschedulingId] = useState(null);
  const [formData, setFormData] = useState({
    user_id: '',
    start_date: '',
    end_date: '',
    type: 'day_off',
    reason: '',
    notes: '',
    location: '',
    is_shop_wide: false
  });

  useEffect(() => {
    loadUsers();
    loadVisibility();
  }, []);

  useEffect(() => {
    loadScheduleEntries();
  }, [currentDate, selectedUserId]);

  const loadVisibility = async () => {
    try {
      const res = await api.get('/schedule/visibility');
      setEmployeesSeeAll(res.data?.employeesSeeAll === true);
    } catch (_) {
      setEmployeesSeeAll(false);
    }
  };

  const handleVisibilityToggle = async () => {
    const next = !employeesSeeAll;
    setVisibilitySaving(true);
    try {
      await api.put('/schedule/visibility', { employeesSeeAll: next });
      setEmployeesSeeAll(next);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to update setting');
    } finally {
      setVisibilitySaving(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.users.filter(u => u.is_active));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadScheduleEntries = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const params = {
        start_date: startOfMonth.toISOString().split('T')[0],
        end_date: endOfMonth.toISOString().split('T')[0]
      };
      
      if (selectedUserId !== 'all') {
        params.user_id = selectedUserId;
      }

      const response = await api.get('/schedule', { params });
      setScheduleEntries(response.data.entries || []);
      setCalendarNames(response.data.calendar_names || {});
    } catch (error) {
      console.error('Error loading schedule entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEntry) {
        await api.put(`/schedule/${editingEntry.id}`, formData);
      } else {
        await api.post('/schedule', formData);
      }
      setShowAddModal(false);
      setEditingEntry(null);
      resetForm();
      loadScheduleEntries();
    } catch (error) {
      console.error('Error saving schedule entry:', error);
      alert(error.response?.data?.error || 'Failed to save schedule entry');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this schedule entry?')) {
      return;
    }
    try {
      await api.delete(`/schedule/${id}`);
      loadScheduleEntries();
    } catch (error) {
      console.error('Error deleting schedule entry:', error);
      alert('Failed to delete schedule entry');
    }
  };

  const handleViewDetails = (entry, e) => {
    if (e) e.stopPropagation();
    setViewingEntry(entry);
  };

  const handleEditFromView = (entry) => {
    setViewingEntry(null);
    setEditingEntry(entry);
    setFormData({
      user_id: entry.is_shop_wide ? '' : (entry.user_id ?? '').toString(),
      start_date: entry.start_date,
      end_date: entry.end_date,
      type: entry.type,
      reason: entry.reason || '',
      notes: entry.notes || '',
      location: entry.location || '',
      is_shop_wide: entry.is_shop_wide === 1 || entry.is_shop_wide === true
    });
    setShowAddModal(true);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      user_id: entry.is_shop_wide ? '' : (entry.user_id ?? '').toString(),
      start_date: entry.start_date,
      end_date: entry.end_date,
      type: entry.type,
      reason: entry.reason || '',
      notes: entry.notes || '',
      location: entry.location || '',
      is_shop_wide: entry.is_shop_wide === 1 || entry.is_shop_wide === true
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      user_id: '',
      start_date: '',
      end_date: '',
      type: 'day_off',
      reason: '',
      notes: '',
      location: '',
      is_shop_wide: false
    });
    setEditingEntry(null);
  };

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!over || typeof over.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(over.id)) return;
    const entry = scheduleEntries.find((e) => e.id === active.id);
    if (!entry || entry.start_date === over.id) return;
    const start = new Date(entry.start_date);
    const end = new Date(entry.end_date);
    const spanDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
    const newStart = over.id;
    const newEnd = addDaysDateOnly(newStart, spanDays - 1);
    setReschedulingId(entry.id);
    try {
      await api.put(`/schedule/${entry.id}`, {
        start_date: newStart,
        end_date: newEnd,
        type: entry.type,
        reason: entry.reason,
        notes: entry.notes,
        location: entry.location,
        status: entry.status,
        is_shop_wide: entry.is_shop_wide === 1 || entry.is_shop_wide === true
      });
      loadScheduleEntries();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reschedule');
    } finally {
      setReschedulingId(null);
    }
  }, [scheduleEntries]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const navigateMonth = (direction) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getEntriesForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return scheduleEntries.filter(entry => {
      const start = new Date(entry.start_date);
      const end = new Date(entry.end_date);
      const current = new Date(dateStr);
      return current >= start && current <= end;
    });
  };

  const getTypeLabel = (type) => {
    const typeLabels = {
      'day_off': 'Day Off',
      'time_off_request': 'Time Off Request',
      'approved_time_off': 'Approved Time Off',
      'out_of_office': 'Out of Office',
      'vacation': 'Vacation',
      'sick_leave': 'Sick Leave',
      'personal_leave': 'Personal Leave',
      'training': 'Training',
      'meeting': 'Meeting',
      'other': 'Other',
      'appointment': 'Appointment',
      'workshop': 'Workshop',
      'conference': 'Conference'
    };
    return typeLabels[type] || type;
  };

  /** Brand colors for Outfitter Events (gold) / Projects (black+gold); otherwise by person or status. */
  const getEntryColor = (entry) => {
    if (entry.is_shop_wide) return 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-100';
    const calName = (entry.source_calendar_id && calendarNames[entry.source_calendar_id]) ? String(calendarNames[entry.source_calendar_id]).toLowerCase() : '';
    if (calName && (calName.includes('outfitter events') || calName === 'outfitter events')) return 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100';
    if (calName && (calName.includes('outfitter projects') || calName.includes('outfitters projects') || calName === 'outfitter projects')) return 'bg-neutral-900 text-amber-400 dark:bg-neutral-800 dark:text-amber-300 border border-amber-500/50';
    if (entry.status === 'rejected') return 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100';
    if (entry.status === 'pending') return 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100';
    if (entry.status === 'approved' || entry.type === 'approved_time_off') return 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100';
    const userPalette = ['bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100', 'bg-sky-200 text-sky-800 dark:bg-sky-800 dark:text-sky-100', 'bg-cyan-200 text-cyan-800 dark:bg-cyan-800 dark:text-cyan-100', 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100', 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100', 'bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-100', 'bg-rose-200 text-rose-800 dark:bg-rose-800 dark:text-rose-100', 'bg-fuchsia-200 text-fuchsia-800 dark:bg-fuchsia-800 dark:text-fuchsia-100', 'bg-violet-200 text-violet-800 dark:bg-violet-800 dark:text-violet-100', 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100'];
    const seed = entry.user_id != null ? entry.user_id : (entry.username || entry.user_name || 'unknown').toString().split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0);
    return userPalette[Math.abs(Number(seed) || 0) % userPalette.length];
  };

  const isGoogleSourced = (entry) => entry?.source === 'google';

  const days = getDaysInMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4 sm:space-y-6">
      <GoogleCalendarSettings />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 dark:bg-neutral-800/50 rounded-xl border border-slate-200 dark:border-neutral-700">
        <div>
          <p className="font-medium text-gray-800 dark:text-neutral-100">What workers see on Schedule</p>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
            {employeesSeeAll ? 'Workers see the full schedule (same as you).' : 'Workers see only their own events and shop closed days.'}
          </p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer shrink-0">
          <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">
            {employeesSeeAll ? 'Full schedule' : 'Only their events + shop closed'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={employeesSeeAll}
            disabled={visibilitySaving}
            onClick={handleVisibilityToggle}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-neutral-900 disabled:opacity-50 ${employeesSeeAll ? 'bg-primary' : 'bg-gray-200 dark:bg-neutral-600'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${employeesSeeAll ? 'translate-x-5' : 'translate-x-1'}`}
              style={{ marginTop: '2px' }}
            />
          </button>
        </label>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-neutral-100 md:text-3xl">Work Schedule Calendar</h2>
          <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
            {viewMode === 'kanban' ? 'Drag cards to another day to reschedule. Click a card to view or edit.' : 'Click an event to view, edit, or delete.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              resetForm();
              setFormData(prev => ({ ...prev, is_shop_wide: true }));
              setShowAddModal(true);
            }}
            className="min-h-[3rem] px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-700 transition font-medium"
          >
            🏪 Add Shop Closed Day
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="min-h-[3rem] px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition font-medium"
          >
            + Add Day Off
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Employee:</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="min-h-[2.75rem] px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
          >
            <option value="all">All Employees</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.full_name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth(-1)}
            className="min-h-[3rem] px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
          >
            ← Previous
          </button>
          <span className="px-4 py-2 font-semibold min-w-[180px] sm:min-w-[200px] text-center text-gray-900 dark:text-neutral-100">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="min-h-[3rem] px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
          >
            Next →
          </button>
        </div>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="min-h-[3rem] px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
        >
          Today
        </button>
        <div className="flex rounded-lg border border-neutral-300 dark:border-neutral-600 overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`min-h-[3rem] px-4 py-2 text-sm font-medium ${viewMode === 'month' ? 'bg-primary text-white dark:bg-amber-600 dark:text-white' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`min-h-[3rem] px-4 py-2 text-sm font-medium ${viewMode === 'kanban' ? 'bg-primary text-white dark:bg-amber-600 dark:text-white' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}
          >
            Kanban
          </button>
        </div>
      </div>

      {/* Calendar or Kanban */}
      {loading ? (
        <div className="text-center py-8 text-gray-600 dark:text-neutral-400">Loading schedule...</div>
      ) : viewMode === 'kanban' ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {reschedulingId && <p className="text-sm text-primary dark:text-amber-400 mb-2">Updating…</p>}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max p-2">
              {days.filter(Boolean).map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <KanbanColumn
                    key={dateStr}
                    dateStr={dateStr}
                    dateLabel={`${date.getDate()} ${monthNames[date.getMonth()].slice(0, 3)}` + (isToday ? ' (Today)' : '')}
                    isToday={isToday}
                    entries={getEntriesForDate(date)}
                    getEntryColor={getEntryColor}
                    onView={handleViewDetails}
                    isGoogleSourced={isGoogleSourced}
                    getTypeLabel={getTypeLabel}
                  />
                );
              })}
            </div>
          </div>
        </DndContext>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden min-w-0">
          <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800">
            {dayNames.map(day => (
              <div key={day} className="p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold bg-gray-50 dark:bg-neutral-800/50 text-gray-700 dark:text-neutral-300 border-r border-neutral-200 dark:border-neutral-700 last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-w-0">
            {days.map((date, index) => {
              const entries = getEntriesForDate(date);
              const isToday = date && date.toDateString() === new Date().toDateString();
              const isCurrentMonth = date !== null;

              return (
                <div
                  key={index}
                  className={`min-h-[100px] sm:min-h-[120px] border-r border-b border-neutral-200 dark:border-neutral-800 p-1.5 sm:p-2 min-w-0 ${
                    !isCurrentMonth ? 'bg-gray-50 dark:bg-neutral-800/30' : 'bg-white dark:bg-neutral-900'
                  } ${isToday ? 'ring-2 ring-inset ring-primary' : ''}`}
                >
                  {date && (
                    <>
                      <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary' : 'text-gray-700 dark:text-neutral-300'}`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {entries.slice(0, 3).map(entry => (
                          <div
                            key={entry.id}
                            role="button"
                            tabIndex={0}
                            className={`text-xs p-1 rounded ${getEntryColor(entry)} cursor-pointer hover:opacity-80`}
                            onClick={() => handleViewDetails(entry)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleViewDetails(entry, e); }}
                            title={`${entry.is_shop_wide ? 'Shop Closed' : (entry.user_name || 'Unknown')}: ${entry.reason || getTypeLabel(entry.type)} — Click for details`}
                          >
                            <div className="truncate font-semibold flex items-center gap-1">
                              {entry.is_shop_wide ? '🏪 Shop Closed' : (entry.user_name || 'Unknown User')}
                              {isGoogleSourced(entry) && (
                                <span
                                  className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/60 text-gray-700 border border-white/80"
                                  title="Synced from Google Calendar"
                                >
                                  G
                                </span>
                              )}
                            </div>
                            {entry.reason && (
                              <div className="truncate text-xs opacity-90 mt-0.5">{entry.reason}</div>
                            )}
                          </div>
                        ))}
                        {entries.length > 3 && (
                          <div className="text-xs text-gray-500 dark:text-neutral-400">
                            +{entries.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View details modal */}
      {viewingEntry && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full sm:mx-4 max-h-[90vh] overflow-y-auto border border-t border-neutral-200 dark:border-neutral-800">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-neutral-100">
                  {viewingEntry.is_shop_wide ? '🏪 Shop Closed' : (viewingEntry.user_name || 'Schedule entry')}
                </h3>
                <button
                  type="button"
                  onClick={() => setViewingEntry(null)}
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className={`inline-block px-2 py-1 rounded text-sm font-medium mb-3 ${getEntryColor(viewingEntry)}`}>
                {getTypeLabel(viewingEntry.type)}
                {viewingEntry.status && viewingEntry.status !== 'scheduled' && viewingEntry.status !== 'approved' && (
                  <span className="ml-1">({viewingEntry.status})</span>
                )}
              </div>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-neutral-400 font-medium">Dates</dt>
                  <dd className="text-gray-900 dark:text-neutral-100">
                    {formatDate(viewingEntry.start_date)}
                    {viewingEntry.start_date !== viewingEntry.end_date && ` – ${formatDate(viewingEntry.end_date)}`}
                  </dd>
                </div>
                {viewingEntry.reason && (
                  <div>
                    <dt className="text-gray-500 dark:text-neutral-400 font-medium">Reason</dt>
                    <dd className="text-gray-900 dark:text-neutral-100">{viewingEntry.reason}</dd>
                  </div>
                )}
                {viewingEntry.notes && (
                  <div>
                    <dt className="text-gray-500 dark:text-neutral-400 font-medium">Notes</dt>
                    <dd className="text-gray-900 dark:text-neutral-100 whitespace-pre-wrap">{viewingEntry.notes}</dd>
                  </div>
                )}
                {viewingEntry.location && (
                  <div>
                    <dt className="text-gray-500 dark:text-neutral-400 font-medium">Location</dt>
                    <dd className="text-gray-900 dark:text-neutral-100">{viewingEntry.location}</dd>
                  </div>
                )}
                {isGoogleSourced(viewingEntry) && (
                  <div>
                    <span className="text-xs px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                      Synced from Google Calendar
                    </span>
                  </div>
                )}
                {viewingEntry.google_event_id && !isGoogleSourced(viewingEntry) && (
                  <div>
                    <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                      Synced to Google Calendar
                    </span>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => handleEditFromView(viewingEntry)}
                  className="min-h-[3rem] flex-1 min-w-[100px] px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition font-medium"
                >
                  Edit
                </button>
                {viewingEntry.id && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this schedule entry?')) {
                        handleDelete(viewingEntry.id);
                        setViewingEntry(null);
                      }
                    }}
                    className="min-h-[3rem] px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-700 transition font-medium"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingEntry(null)}
                  className="min-h-[3rem] px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition text-gray-700 dark:text-neutral-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full sm:mx-4 max-h-[90vh] overflow-y-auto border border-t border-neutral-200 dark:border-neutral-800">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-neutral-100">
                  {editingEntry ? 'Edit Schedule Entry' : 'Add Day Off'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
                When Google Calendar is connected (Admin → Schedule → Google Calendar), approved and scheduled entries are synced to your Google Calendar automatically.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.is_shop_wide}
                      onChange={(e) => {
                        const isShopWide = e.target.checked;
                        setFormData({ 
                          ...formData, 
                          is_shop_wide: isShopWide,
                          user_id: isShopWide ? '' : formData.user_id // Clear user_id if shop-wide
                        });
                      }}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                      🏪 Shop Closed (applies to all employees)
                    </span>
                  </label>
                </div>

                {!formData.is_shop_wide && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                      Employee *
                    </label>
                    <select
                      value={formData.user_id}
                      onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                      required={!formData.is_shop_wide}
                      className="w-full h-12 px-4 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                      <option value="">Select employee</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    className="w-full h-12 px-4 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                    className="w-full h-12 px-4 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full h-12 px-4 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="day_off">Day Off</option>
                    <option value="time_off_request">Time Off Request</option>
                    <option value="approved_time_off">Approved Time Off</option>
                    <option value="out_of_office">Out of Office</option>
                    <option value="vacation">Vacation</option>
                    <option value="sick_leave">Sick Leave</option>
                    <option value="personal_leave">Personal Leave</option>
                    <option value="training">Training</option>
                    <option value="meeting">Meeting</option>
                    <option value="appointment">Appointment</option>
                    <option value="workshop">Workshop</option>
                    <option value="conference">Conference</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="e.g., Vacation, Sick Day, Personal"
                    className="w-full h-12 px-4 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 placeholder-neutral-400 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Address or venue"
                    className="w-full h-12 px-4 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 placeholder-neutral-400 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Additional notes..."
                    className="w-full min-h-[4rem] px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 placeholder-neutral-400 focus:ring-2 focus:ring-primary focus:outline-none resize-y"
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-4">
                  <button
                    type="submit"
                    className="min-h-[3rem] flex-1 min-w-[120px] px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition font-medium"
                  >
                    {editingEntry ? 'Update' : 'Add'} Schedule Entry
                  </button>
                  {editingEntry && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingEntry.id)}
                      className="min-h-[3rem] px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-700 transition font-medium"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="min-h-[3rem] px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition text-gray-700 dark:text-neutral-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleCalendar;

