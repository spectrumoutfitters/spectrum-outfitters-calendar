import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ClockInOut from '../components/TimeClock/ClockInOut';
import EditTimeEntryModal from '../components/TimeClock/EditTimeEntryModal';
import AdminTimeClock from '../components/Admin/AdminTimeClock';
import api from '../utils/api';
import { formatDateTime, formatDate, formatTime, getTodayCentralTime } from '../utils/helpers';

const TimeEntries = () => {
  const { user, isAdmin } = useAuth();
  const [entries, setEntries] = useState([]);
  const [groupedDays, setGroupedDays] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(user.id);
  const [users, setUsers] = useState([]);
  
  // Default to current week (Monday to Sunday)
  const getCurrentWeekRange = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    };
  };
  
  const weekRange = getCurrentWeekRange();
  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
    loadTimeEntries();
  }, [selectedUserId, startDate, endDate]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers((Array.isArray(response.data.users) ? response.data.users : []).filter(u => u.is_active));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTimeEntries = async () => {
    setLoading(true);
    try {
      const params = {
        user_id: isAdmin ? selectedUserId : user.id,
        start_date: startDate,
        end_date: endDate
      };
      // Use grouped endpoint for consistent display
      const response = await api.get('/time/entries/grouped', { params });
      setGroupedDays(response.data.days || []);
    } catch (error) {
      console.error('Error loading time entries:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalHours = () => {
    return groupedDays
      .reduce((sum, day) => sum + (parseFloat(day.totalHours) || 0), 0)
      .toFixed(2);
  };

  const calculateTotalCost = () => {
    return groupedDays
      .reduce((sum, day) => sum + (parseFloat(day.totalCost) || 0), 0)
      .toFixed(2);
  };

  const handleEntryUpdate = () => {
    setEditingEntry(null);
    loadTimeEntries();
  };

  const handleEditClick = async (entry) => {
    // Fetch the full entry details from the backend
    try {
      const response = await api.get(`/time/entries/${entry.id}`);
      setEditingEntry(response.data.entry);
    } catch (error) {
      console.error('Error loading entry:', error);
      // Fallback to using the entry we have
      setEditingEntry(entry);
    }
  };

  const handleEditLunchBreak = async (lunchBreak) => {
    // Fetch the full lunch break entry from the backend
    try {
      const response = await api.get(`/time/entries/${lunchBreak.id}`);
      setEditingEntry(response.data.entry);
    } catch (error) {
      console.error('Error loading lunch break entry:', error);
    }
  };

  // If admin, show both clock in/out and admin time clock view
  if (isAdmin) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-neutral-100">Time Clock</h1>

        {/* Clock In/Out for Admin */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-transparent dark:border-neutral-800 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4 text-gray-900 dark:text-neutral-100">Your Time Clock</h2>
          <ClockInOut />
        </div>
        
        {/* Admin Time Clock View */}
        <AdminTimeClock />
      </div>
    );
  }

  // Employee view - same grouped display as admin but without edit buttons
  const selectedUser = users.find(u => u.id.toString() === selectedUserId.toString()) || user;
  const totalHours = parseFloat(calculateTotalHours());

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-neutral-100">Time Clock</h1>

      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-transparent dark:border-neutral-800 p-4 sm:p-6">
        <ClockInOut />
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-transparent dark:border-neutral-800 p-4 sm:p-6">
        <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
            />
          </div>
        </div>

        <div className="mb-6 p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-neutral-200">Total Hours</p>
              <p className="text-lg font-semibold text-primary">{totalHours.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-600 dark:text-neutral-200">Loading time entries...</div>
        ) : groupedDays.length === 0 ? (
          <p className="text-gray-500 dark:text-neutral-200 text-center py-8">No time entries found for this period</p>
        ) : (
          <div className="space-y-4">
            {groupedDays.map((day) => {
              // Use Central Time for "today" comparison to match backend
              const today = getTodayCentralTime();
              const isToday = day.date === today;
              const hasWorkEntries = day.workEntries && day.workEntries.length > 0;
              const hasLunchBreaks = day.lunchBreaks && day.lunchBreaks.length > 0;
              
              if (!hasWorkEntries && !hasLunchBreaks && !isToday) {
                return null;
              }
              
              return (
                <div key={day.date} className="border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-neutral-800 px-3 sm:px-4 py-3 border-b border-gray-200 dark:border-neutral-700">
                    <div className="flex flex-wrap justify-between items-center gap-1">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-neutral-100">
                        {formatDate(day.date)}
                        {isToday && <span className="text-sm text-primary font-normal ml-2">(Today)</span>}
                      </h3>
                      <div className="flex flex-wrap gap-3 sm:gap-6 text-sm">
                        <span className="text-gray-600 dark:text-neutral-200">
                          Hours: <span className="font-semibold text-primary">{parseFloat(day.totalHours || 0).toFixed(2)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-2 sm:p-4">
                    {hasWorkEntries ? (
                      <div className="overflow-x-auto -mx-2 sm:mx-0">
                      <table className="min-w-full">
                        <thead className="bg-gray-50 dark:bg-neutral-800">
                          <tr>
                            <th className="text-left py-2 px-4 text-sm font-medium text-gray-700 dark:text-neutral-200">Clock In</th>
                            <th className="text-left py-2 px-4 text-sm font-medium text-gray-700 dark:text-neutral-200">Clock Out</th>
                            <th className="text-left py-2 px-4 text-sm font-medium text-gray-700 dark:text-neutral-200">Break</th>
                            <th className="text-left py-2 px-4 text-sm font-medium text-gray-700 dark:text-neutral-200">Hours</th>
                            <th className="text-left py-2 px-4 text-sm font-medium text-gray-700 dark:text-neutral-200">Lunch Break</th>
                            <th className="text-left py-2 px-4 text-sm font-medium text-gray-700 dark:text-neutral-200">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {day.workEntries.map((entry, index) => {
                            // Find matching lunch break (same logic as admin view)
                            let lunchBreak = null;
                            
                            if (entry.isPreLunchWork) {
                              lunchBreak = day.lunchBreaks.find(lunch => {
                                if (!lunch.clockOut || !entry.clock_out) return false;
                                const lunchOut = new Date(lunch.clockOut);
                                const entryOut = new Date(entry.clock_out);
                                return Math.abs(lunchOut - entryOut) < 60000;
                              });
                            } else {
                              const entryIn = new Date(entry.clock_in);
                              const entryOut = entry.clock_out ? new Date(entry.clock_out) : new Date();
                              const nextEntry = day.workEntries[index + 1];
                              const nextEntryIn = nextEntry ? new Date(nextEntry.clock_in) : entryOut;
                              
                              lunchBreak = day.lunchBreaks.find(lunch => {
                                if (!lunch.clockOut) return false;
                                const lunchOut = new Date(lunch.clockOut);
                                return lunchOut >= entryIn && lunchOut < nextEntryIn;
                              });
                            }
                            
                            if (!lunchBreak && day.lunchBreaks.length === 1) {
                              lunchBreak = day.lunchBreaks[0];
                            }
                            
                            // Determine if this entry is still in progress
                            // For pre-lunch work entries: if there's a return entry (clockIn exists) but no end-of-day clock out yet
                            // For regular entries: if no clock_out exists
                            const isStillInProgress = entry.isPreLunchWork 
                              ? (lunchBreak && lunchBreak.clockIn && entry.original_clock_out && !entry.clock_out) || (!entry.clock_out)
                              : !entry.clock_out;
                            
                            // For display: if this is a pre-lunch entry, only show clock_out if it's the actual end-of-day time
                            // (i.e., different from original_clock_out which is the lunch break time)
                            const displayClockOut = entry.isPreLunchWork && entry.original_clock_out
                              ? (entry.clock_out && entry.clock_out !== entry.original_clock_out ? entry.clock_out : null)
                              : entry.clock_out;

                            return (
                              <tr key={entry.id} className="border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">
                                <td className="py-2 px-4 text-gray-900 dark:text-neutral-100">
                                  {entry.clock_in ? formatTime(entry.clock_in) : '—'}
                                </td>
                                <td className="py-2 px-4 text-gray-900 dark:text-neutral-100">
                                  {displayClockOut ? (
                                    formatTime(displayClockOut)
                                  ) : isStillInProgress ? (
                                    <span className="text-primary font-semibold">In progress</span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="py-2 px-4 text-gray-900 dark:text-neutral-100">{entry.break_minutes || 0} min</td>
                                <td className="py-2 px-4 font-semibold text-gray-900 dark:text-neutral-100">{entry.hours || '0.00'}</td>
                                <td className="py-2 px-4">
                                  {lunchBreak ? (
                                    <div className="text-sm">
                                      <div className="text-gray-600 dark:text-neutral-200">
                                        Out: <span className="font-medium">
                                          {lunchBreak.clockOut ? formatTime(lunchBreak.clockOut) : '—'}
                                        </span>
                                      </div>
                                      <div className="text-gray-600 dark:text-neutral-200">
                                        In: <span className="font-medium">
                                          {lunchBreak.clockIn ? formatTime(lunchBreak.clockIn) : 'Not returned yet'}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-neutral-300 mt-1">
                                        ({lunchBreak.duration || 0} min)
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 dark:text-neutral-400">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-4 text-sm text-gray-600 dark:text-neutral-200">{entry.notes || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-neutral-200 text-center py-4">No work entries for this day</p>
                    )}
                    
                    {hasLunchBreaks && !hasWorkEntries && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2">Lunch Breaks:</h4>
                        {day.lunchBreaks.map((lunchBreak) => (
                          <div key={lunchBreak.id} className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-3 mb-2">
                            <div className="text-sm">
                              <div className="text-gray-700 dark:text-neutral-200">
                                Out: <span className="font-medium">{lunchBreak.clockOut ? formatTime(lunchBreak.clockOut) : '—'}</span>
                              </div>
                              <div className="text-gray-700 dark:text-neutral-200">
                                In: <span className="font-medium">{lunchBreak.clockIn ? formatTime(lunchBreak.clockIn) : 'Not returned yet'}</span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-neutral-300 mt-1">
                                Duration: {lunchBreak.duration || 0} min
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeEntries;

