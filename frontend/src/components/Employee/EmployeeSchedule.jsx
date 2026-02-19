import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';

const EmployeeSchedule = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    type: 'time_off_request',
    reason: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadScheduleEntries();
  }, [currentDate]);

  const loadScheduleEntries = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const response = await api.get('/schedule', {
        params: {
          start_date: startOfMonth.toISOString().split('T')[0],
          end_date: endOfMonth.toISOString().split('T')[0]
        }
      });
      setScheduleEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error loading schedule entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Employees don't need to send user_id or status - backend handles this
      await api.post('/schedule', {
        start_date: formData.start_date,
        end_date: formData.end_date,
        type: formData.type || 'time_off_request',
        reason: formData.reason,
        notes: formData.notes
      });
      setShowRequestModal(false);
      setFormData({
        start_date: '',
        end_date: '',
        type: 'time_off_request',
        reason: '',
        notes: ''
      });
      loadScheduleEntries();
      alert('Time off request submitted successfully!');
    } catch (error) {
      console.error('Error submitting request:', error);
      alert(error.response?.data?.error || 'Failed to submit time off request');
    } finally {
      setSubmitting(false);
    }
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

  const getEntryColor = (entry) => {
    if (entry.is_shop_wide) return 'bg-purple-200 text-purple-800'; // Shop-wide entries in purple
    if (entry.status === 'rejected') return 'bg-red-200 text-red-800';
    if (entry.status === 'pending') return 'bg-yellow-200 text-yellow-800';
    if (entry.status === 'approved' || entry.type === 'approved_time_off') return 'bg-green-200 text-green-800';
    return 'bg-blue-200 text-blue-800';
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

  const getEntryLabel = (entry) => {
    if (entry.is_shop_wide) return 'Shop Closed';
    if (entry.status === 'pending') return `Pending ${getTypeLabel(entry.type)}`;
    if (entry.status === 'approved') return getTypeLabel(entry.type);
    if (entry.status === 'rejected') return 'Rejected';
    return entry.reason || getTypeLabel(entry.type);
  };

  const days = getDaysInMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">My Schedule</h2>
        <button
          onClick={() => setShowRequestModal(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + Request Time Off
        </button>
      </div>

      {/* Calendar Navigation */}
      <div className="bg-white rounded-lg shadow-md p-4 flex gap-4 items-center justify-between">
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

      {/* Legend */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold mb-2">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-200 rounded"></div>
            <span>Shop Closed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-200 rounded"></div>
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-200 rounded"></div>
            <span>Pending Request</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-200 rounded"></div>
            <span>Approved</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-200 rounded"></div>
            <span>Rejected</span>
          </div>
        </div>
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
                        {entries.map(entry => (
                          <div
                            key={entry.id}
                            className={`text-xs p-1 rounded ${getEntryColor(entry)}`}
                            title={`${getEntryLabel(entry)}: ${entry.reason || 'No reason provided'}`}
                          >
                            <div className="truncate font-medium">{getEntryLabel(entry)}</div>
                            {entry.reason && (
                              <div className="truncate text-xs opacity-90">{entry.reason}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Request Time Off Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-800">Request Time Off</h3>
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setFormData({
                      start_date: '',
                      end_date: '',
                      reason: '',
                      notes: ''
                    });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    min={new Date().toISOString().split('T')[0]}
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
                    min={formData.start_date || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="time_off_request">Time Off Request</option>
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
                    Reason *
                  </label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                    placeholder="e.g., Vacation, Sick Day, Personal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Any additional information..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestModal(false);
                      setFormData({
                        start_date: '',
                        end_date: '',
                        type: 'time_off_request',
                        reason: '',
                        notes: ''
                      });
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

export default EmployeeSchedule;

