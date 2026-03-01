import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatTime, getTodayCentralTime } from '../../utils/helpers';
import EditTimeEntryModal from '../TimeClock/EditTimeEntryModal';
import { useAuth } from '../../contexts/AuthContext';

const AdminTimeClock = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  
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
  const [groupedDays, setGroupedDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadTimeEntries();
    }
  }, [selectedUserId, startDate, endDate]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      const activeUsers = (Array.isArray(response.data.users) ? response.data.users : []).filter(u => u.is_active);
      setUsers(activeUsers);
      if (activeUsers.length > 0 && !selectedUserId) {
        // Default to current admin user if available, otherwise first user
        const defaultUserId = user?.id ? user.id.toString() : activeUsers[0].id.toString();
        setSelectedUserId(defaultUserId);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTimeEntries = async () => {
    if (!selectedUserId) return;
    
    setLoading(true);
    try {
      const response = await api.get('/time/entries/grouped', {
        params: {
          user_id: selectedUserId,
          start_date: startDate,
          end_date: endDate
        }
      });
      console.log('Grouped time entries response:', response.data);
      setGroupedDays(response.data.days || []);
    } catch (error) {
      console.error('Error loading time entries:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setLoading(false);
    }
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
      const lunchEntryResponse = await api.get(`/time/entries/${lunchBreak.id}`);
      const lunchEntry = lunchEntryResponse.data.entry;
      
      // Create a combined entry object that includes both lunch break and return times
      const combinedEntry = {
        ...lunchEntry,
        lunchReturnEntryId: lunchBreak.returnEntryId || null,
        lunchReturnClockIn: lunchBreak.clockIn || null,
        isLunchBreak: true
      };
      
      console.log('Editing lunch break:', {
        lunchBreakId: lunchBreak.id,
        returnEntryId: lunchBreak.returnEntryId,
        clockIn: lunchBreak.clockIn,
        lunchBreakObject: lunchBreak,
        combinedEntry
      });
      
      // If clockIn exists but wasn't passed, try to get it from the lunchBreak object
      if (!combinedEntry.lunchReturnClockIn && lunchBreak.clockIn) {
        combinedEntry.lunchReturnClockIn = lunchBreak.clockIn;
      }
      
      setEditingEntry(combinedEntry);
    } catch (error) {
      console.error('Error loading lunch break entry:', error);
      alert('Failed to load lunch break entry');
    }
  };

  const selectedUser = users.find(u => u.id.toString() === selectedUserId);
  const totalHours = groupedDays.reduce((sum, day) => sum + parseFloat(day.totalHours || 0), 0);
  const totalCost = groupedDays.reduce((sum, day) => sum + parseFloat(day.totalCost || 0), 0);
  const effectiveHourlyRate = selectedUser && groupedDays.length > 0 
    ? groupedDays[0].effectiveHourlyRate 
    : (selectedUser?.weekly_salary > 0 ? (selectedUser.weekly_salary / 40).toFixed(2) : (selectedUser?.hourly_rate || 0).toFixed(2));

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-neutral-100">Admin Time Clock</h1>

      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-4 sm:p-6">
        <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
              Employee
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
            />
          </div>
        </div>

        {selectedUser && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-neutral-950 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-neutral-100">Employee</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-neutral-100">{selectedUser.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-neutral-100">Hourly Rate</p>
                <p className="text-lg font-semibold text-amber-600">
                  ${effectiveHourlyRate}
                  {selectedUser.weekly_salary > 0 && (
                    <span className="text-xs text-amber-500 ml-1">
                      (from ${selectedUser.weekly_salary.toFixed(2)}/week)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-neutral-100">Total Hours</p>
                <p className="text-lg font-semibold text-primary">{totalHours.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-neutral-100">Total Cost</p>
                <p className="text-lg font-semibold text-red-600">${totalCost.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">Loading time entries...</div>
        ) : groupedDays.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No time entries found for this period</p>
        ) : (
          <div className="space-y-4">
            {groupedDays.map((day) => {
              // Show day if it has work entries OR lunch breaks OR is today (even if no entries yet)
              // Use Central Time for "today" comparison to match backend
              const today = getTodayCentralTime();
              const isToday = day.date === today;
              const hasWorkEntries = day.workEntries && day.workEntries.length > 0;
              const hasLunchBreaks = day.lunchBreaks && day.lunchBreaks.length > 0;
              
              if (!hasWorkEntries && !hasLunchBreaks && !isToday) {
                console.log('Day with no entries (not today):', day);
                return null;
              }
              
              // If it's today but has no entries, create a placeholder entry structure
              if (isToday && !hasWorkEntries && !hasLunchBreaks) {
                return (
                  <div key={day.date} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-neutral-950 px-4 py-3 border-b border-gray-200 dark:border-neutral-700">
                      <div className="flex flex-wrap justify-between items-center gap-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-neutral-100">{formatDate(day.date)} <span className="text-sm text-primary font-normal">(Today)</span></h3>
                        <div className="flex flex-wrap gap-3 sm:gap-6 text-sm">
                          <span className="text-gray-600 dark:text-neutral-100">
                            Hours: <span className="font-semibold text-primary">0.00</span>
                          </span>
                          <span className="text-gray-600 dark:text-neutral-100">
                            Cost: <span className="font-semibold text-success">$0.00</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-gray-500 text-center py-4">No time entries for today yet</p>
                    </div>
                  </div>
                );
              }
              
              // If it's today and has lunch breaks but no work entries, show lunch breaks
              if (isToday && !hasWorkEntries && hasLunchBreaks) {
                return (
                  <div key={day.date} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-neutral-950 px-4 py-3 border-b border-gray-200 dark:border-neutral-700">
                      <div className="flex flex-wrap justify-between items-center gap-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-neutral-100">{formatDate(day.date)} <span className="text-sm text-primary font-normal">(Today)</span></h3>
                        <div className="flex flex-wrap gap-3 sm:gap-6 text-sm">
                          <span className="text-gray-600 dark:text-neutral-100">
                            Hours: <span className="font-semibold text-primary">{parseFloat(day.totalHours || 0).toFixed(2)}</span>
                          </span>
                          <span className="text-gray-600 dark:text-neutral-100">
                            Cost: <span className="font-semibold text-red-600">${parseFloat(day.totalCost || 0).toFixed(2)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Lunch Breaks:</h4>
                        {day.lunchBreaks.map((lunchBreak) => (
                          <div key={lunchBreak.id} className="bg-orange-50 border border-orange-200 rounded p-3 mb-2">
                            <div className="text-sm">
                              <div className="text-gray-700">
                                Out: <span className="font-medium">{lunchBreak.clockOut ? formatTime(lunchBreak.clockOut) : '—'}</span>
                              </div>
                              <div className="text-gray-700">
                                In: <span className="font-medium">{lunchBreak.clockIn ? formatTime(lunchBreak.clockIn) : 'Not returned yet'}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Duration: {lunchBreak.duration || 0} min
                              </div>
                              <button
                                onClick={() => handleEditLunchBreak(lunchBreak)}
                                className="mt-2 text-xs text-primary hover:text-blue-700 font-medium"
                              >
                                Edit Lunch
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-gray-500 text-center py-2">No work entries for today yet</p>
                    </div>
                  </div>
                );
              }
              
              return (
              <div key={day.date} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-neutral-950 px-3 sm:px-4 py-3 border-b border-gray-200 dark:border-neutral-700">
                  <div className="flex flex-wrap justify-between items-center gap-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-neutral-100">{formatDate(day.date)}</h3>
                    <div className="flex flex-wrap gap-3 sm:gap-6 text-sm">
                      <span className="text-gray-600 dark:text-neutral-100">
                        Hours: <span className="font-semibold text-primary">{parseFloat(day.totalHours).toFixed(2)}</span>
                      </span>
                      <span className="text-gray-600 dark:text-neutral-100">
                        Cost: <span className="font-semibold text-red-600">${parseFloat(day.totalCost).toFixed(2)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2 sm:p-4">
                  <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 dark:bg-neutral-950">
                      <tr>
                        <th className="text-left py-2 px-4 text-sm font-medium">Clock In</th>
                        <th className="text-left py-2 px-4 text-sm font-medium">Clock Out</th>
                        <th className="text-left py-2 px-4 text-sm font-medium">Break</th>
                        <th className="text-left py-2 px-4 text-sm font-medium">Hours</th>
                        <th className="text-left py-2 px-4 text-sm font-medium">Lunch Break</th>
                        <th className="text-left py-2 px-4 text-sm font-medium">Notes</th>
                        <th className="text-left py-2 px-4 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.workEntries.map((entry, index) => {
                        // Find matching lunch break for this entry
                        // If this is a pre-lunch work entry, find the lunch break that matches its clock_out
                        // Otherwise, find lunch breaks that occurred during this work period
                        let lunchBreak = null;
                        
                        if (entry.isPreLunchWork) {
                          // This entry IS the lunch break work entry - find the matching lunch break
                          lunchBreak = day.lunchBreaks.find(lunch => {
                            // Match by clock_out time (when they went to lunch)
                            if (!lunch.clockOut || !entry.clock_out) return false;
                            const lunchOut = new Date(lunch.clockOut);
                            const entryOut = new Date(entry.clock_out);
                            // Allow 1 minute tolerance for time differences
                            return Math.abs(lunchOut - entryOut) < 60000;
                          });
                        } else {
                          // Regular work entry - find lunch breaks that occurred during this period
                          const entryIn = new Date(entry.clock_in);
                          const entryOut = entry.clock_out ? new Date(entry.clock_out) : new Date();
                          const nextEntry = day.workEntries[index + 1];
                          const nextEntryIn = nextEntry ? new Date(nextEntry.clock_in) : entryOut;
                          
                          lunchBreak = day.lunchBreaks.find(lunch => {
                            if (!lunch.clockOut) return false;
                            const lunchOut = new Date(lunch.clockOut);
                            // Lunch break occurred after this entry started and before next entry (or this entry ended)
                            return lunchOut >= entryIn && lunchOut < nextEntryIn;
                          });
                        }
                        
                        // Also check all lunch breaks for this day if we haven't found one yet
                        // Sometimes lunch breaks might not match perfectly due to timing
                        if (!lunchBreak && day.lunchBreaks.length > 0) {
                          // Try to match by date - if there's only one lunch break for the day, use it
                          if (day.lunchBreaks.length === 1) {
                            lunchBreak = day.lunchBreaks[0];
                          } else {
                            // Find the lunch break closest to this entry's clock_out time
                            if (entry.clock_out) {
                              const entryOut = new Date(entry.clock_out);
                              let closestLunch = null;
                              let minDiff = Infinity;
                              day.lunchBreaks.forEach(lunch => {
                                if (lunch.clockOut) {
                                  const lunchOut = new Date(lunch.clockOut);
                                  const diff = Math.abs(lunchOut - entryOut);
                                  if (diff < minDiff) {
                                    minDiff = diff;
                                    closestLunch = lunch;
                                  }
                                }
                              });
                              // Only use if within 2 hours (reasonable lunch duration)
                              if (minDiff < 2 * 60 * 60 * 1000) {
                                lunchBreak = closestLunch;
                              }
                            }
                          }
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
                            <td className="py-2 px-4">
                              {entry.clock_in ? formatTime(entry.clock_in) : '—'}
                            </td>
                            <td className="py-2 px-4">
                              {displayClockOut ? (
                                formatTime(displayClockOut)
                              ) : isStillInProgress ? (
                                <span className="text-primary font-semibold">In progress</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2 px-4">{entry.break_minutes || 0} min</td>
                            <td className="py-2 px-4 font-semibold">{entry.hours || '0.00'}</td>
                            <td className="py-2 px-4">
                              {lunchBreak ? (
                                <div className="text-sm">
                                  <div className="text-gray-600">
                                    Out: <span className="font-medium">
                                      {lunchBreak.clockOut ? formatTime(lunchBreak.clockOut) : '—'}
                                    </span>
                                  </div>
                                  <div className="text-gray-600">
                                    In: <span className="font-medium">
                                      {lunchBreak.clockIn ? formatTime(lunchBreak.clockIn) : 'Not returned yet'}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    ({lunchBreak.duration || 0} min)
                                  </div>
                                  <button
                                    onClick={() => handleEditLunchBreak(lunchBreak)}
                                    className="mt-2 text-xs text-primary hover:text-blue-700 font-medium"
                                  >
                                    Edit Lunch
                                  </button>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2 px-4 text-sm text-gray-600">
                              {entry.notes || '—'}
                            </td>
                            <td className="py-2 px-4">
                              <button
                                onClick={() => handleEditClick(entry)}
                                className="text-primary hover:text-blue-700 text-sm font-medium"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {editingEntry && (
        <EditTimeEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onUpdate={handleEntryUpdate}
        />
      )}
    </div>
  );
};

export default AdminTimeClock;

