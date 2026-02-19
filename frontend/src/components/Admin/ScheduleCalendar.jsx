import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import GoogleCalendarSettings from './GoogleCalendarSettings';

const ScheduleCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [employeesSeeAll, setEmployeesSeeAll] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    start_date: '',
    end_date: '',
    type: 'day_off',
    reason: '',
    notes: '',
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

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      user_id: entry.is_shop_wide ? '' : entry.user_id.toString(),
      start_date: entry.start_date,
      end_date: entry.end_date,
      type: entry.type,
      reason: entry.reason || '',
      notes: entry.notes || '',
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
      is_shop_wide: false
    });
    setEditingEntry(null);
  };

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
      'other': 'Other'
    };
    return typeLabels[type] || type;
  };

  const getEntryColor = (entry) => {
    if (entry.is_shop_wide) return 'bg-purple-200 text-purple-800'; // Shop-wide entries in purple
    if (entry.status === 'rejected') return 'bg-red-200 text-red-800';
    if (entry.status === 'pending') return 'bg-yellow-200 text-yellow-800';
    if (entry.status === 'approved' || entry.type === 'approved_time_off') return 'bg-green-200 text-green-800';
    return 'bg-primary-subtle text-primary';
  };

  const isGoogleSourced = (entry) => entry?.source === 'google';

  const days = getDaysInMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      <GoogleCalendarSettings />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div>
          <p className="font-medium text-gray-800">What workers see on Schedule</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {employeesSeeAll ? 'Workers see the full schedule (same as you).' : 'Workers see only their own events and shop closed days.'}
          </p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer shrink-0">
          <span className="text-sm font-medium text-gray-700">
            {employeesSeeAll ? 'Full schedule' : 'Only their events + shop closed'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={employeesSeeAll}
            disabled={visibilitySaving}
            onClick={handleVisibilityToggle}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${employeesSeeAll ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${employeesSeeAll ? 'translate-x-5' : 'translate-x-1'}`}
              style={{ marginTop: '2px' }}
            />
          </button>
        </label>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Work Schedule Calendar</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              resetForm();
              setFormData(prev => ({ ...prev, is_shop_wide: true }));
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-700 transition font-medium"
          >
            🏪 Add Shop Closed Day
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition font-medium"
          >
            + Add Day Off
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Employee:</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
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
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Previous
          </button>
          <span className="px-4 py-2 font-semibold min-w-[200px] text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Today
        </button>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="text-center py-8">Loading schedule...</div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="grid grid-cols-7 border-b">
            {dayNames.map(day => (
              <div key={day} className="p-3 text-center font-semibold bg-gray-50 border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((date, index) => {
              const entries = getEntriesForDate(date);
              const isToday = date && date.toDateString() === new Date().toDateString();
              const isCurrentMonth = date !== null;

              return (
                <div
                  key={index}
                  className={`min-h-[120px] border-r border-b p-2 ${
                    !isCurrentMonth ? 'bg-gray-50' : 'bg-white'
                  } ${isToday ? 'ring-2 ring-primary' : ''}`}
                >
                  {date && (
                    <>
                      <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary' : 'text-gray-700'}`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {entries.slice(0, 3).map(entry => (
                          <div
                            key={entry.id}
                            className={`text-xs p-1 rounded ${getEntryColor(entry)} cursor-pointer hover:opacity-80`}
                            onClick={() => handleEdit(entry)}
                            title={`${entry.is_shop_wide ? 'Shop Closed' : (entry.user_name || 'Unknown')}: ${entry.reason || getTypeLabel(entry.type)}`}
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
                          <div className="text-xs text-gray-500">
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

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-800">
                  {editingEntry ? 'Edit Schedule Entry' : 'Add Day Off'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

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
                    <span className="text-sm font-medium text-gray-700">
                      🏪 Shop Closed (applies to all employees)
                    </span>
                  </label>
                </div>

                {!formData.is_shop_wide && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee *
                    </label>
                    <select
                      value={formData.user_id}
                      onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                      required={!formData.is_shop_wide}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select employee</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="e.g., Vacation, Sick Day, Personal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Additional notes..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
                  >
                    {editingEntry ? 'Update' : 'Add'} Schedule Entry
                  </button>
                  {editingEntry && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingEntry.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-700 transition"
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
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
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

