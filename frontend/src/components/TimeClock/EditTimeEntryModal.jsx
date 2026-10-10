import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { centralToUTC, toCentralDateTime } from '../../utils/centralDateTimeLocal';
import { formatDateTime } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';

const EditTimeEntryModal = ({ entry, onClose, onUpdate }) => {
  const { isAdmin } = useAuth();
  const [formData, setFormData] = useState({
    clock_in: '',
    clock_out: '',
    break_minutes: 0,
    notes: '',
    lunch_return_clock_in: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (entry) {
      // Convert UTC datetime strings to Central Time datetime-local format
      setFormData({
        clock_in: toCentralDateTime(entry.clock_in),
        clock_out: toCentralDateTime(entry.clock_out),
        break_minutes: entry.break_minutes || 0,
        notes: entry.notes || '',
        lunch_return_clock_in: toCentralDateTime(entry.lunchReturnClockIn || '')
      });
    }
  }, [entry]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Convert Central Time datetime-local format to UTC ISO string
      // Prepare updateData for regular entries
      const updateData = {
        clock_in: centralToUTC(formData.clock_in),
        clock_out: centralToUTC(formData.clock_out),
        break_minutes: parseInt(formData.break_minutes) || 0,
        notes: formData.notes || null
      };
      
      // If this is a lunch break, handle it differently
      if (entry.isLunchBreak) {
        // For lunch breaks, we update clock_out (lunch start time) and preserve clock_in (work start time)
        // Make sure clock_in is included to preserve the original work start time
        const lunchUpdateData = {
          clock_in: centralToUTC(formData.clock_in), // Preserve original work start time
          clock_out: centralToUTC(formData.clock_out),
          break_minutes: parseInt(formData.break_minutes) || 0,
          notes: formData.notes || null
        };
        
        // Update lunch break entry (clock out time only)
        const lunchResponse = await api.put(`/time/entries/${entry.id}`, lunchUpdateData);
        console.log('Lunch break entry updated:', lunchResponse.data);
        
        // Get lunch out time for validation
        const lunchOutTime = new Date(lunchUpdateData.clock_out);
        const lunchOutDateStr = lunchOutTime.toISOString().split('T')[0];
        
        // Update return entry if we have the return time (optional - employee might not have returned yet)
        if (formData.lunch_return_clock_in && formData.lunch_return_clock_in.trim()) {
          let validReturnEntryId = null;
          let foundReturnEntry = false;
          
          if (entry.lunchReturnEntryId) {
            // Validate that the return entry is on the same day before using it
            try {
              const returnEntryResponse = await api.get(`/time/entries/${entry.lunchReturnEntryId}`);
              const returnEntry = returnEntryResponse.data.entry;
              
              const returnEntryDate = new Date(returnEntry.clock_in).toISOString().split('T')[0];
              
              if (returnEntryDate === lunchOutDateStr) {
                // Return entry is on the same day - safe to use
                validReturnEntryId = entry.lunchReturnEntryId;
                console.log(`Validated return entry ${validReturnEntryId} is on same day (${returnEntryDate})`);
                foundReturnEntry = true;
              } else {
                // Return entry is on a different day - ignore it
                console.warn(`Return entry ${entry.lunchReturnEntryId} is on different day (${returnEntryDate} vs ${lunchOutDateStr}). Ignoring.`);
              }
            } catch (err) {
              console.error('Error validating return entry:', err);
              // If we can't validate, don't use it
            }
          }
          
          // If we have a valid returnEntryId, update it
          if (validReturnEntryId) {
            const returnResponse = await api.put(`/time/entries/${validReturnEntryId}`, {
              clock_in: centralToUTC(formData.lunch_return_clock_in)
            });
            console.log('Return entry updated:', returnResponse.data);
            foundReturnEntry = true;
          }
          
          // If we haven't found it yet, try searching by the original return time (if provided)
          if (!foundReturnEntry && entry.lunchReturnClockIn) {
            // We have a return time but no ID - search for the entry with that clock_in time
            console.log('Searching for return entry by clock_in time:', entry.lunchReturnClockIn);
            try {
              const searchResponse = await api.get('/time/entries', {
                params: {
                  user_id: entry.user_id,
                  start_date: lunchOutDateStr,
                  end_date: lunchOutDateStr
                }
              });
              
              // Find entry with matching clock_in time (within a few seconds tolerance)
              const originalReturnTime = new Date(entry.lunchReturnClockIn).getTime();
              const matchingEntry = searchResponse.data.entries.find(e => {
                if (!e.clock_in || e.id === entry.id) return false;
                if (e.notes && e.notes.toLowerCase().includes('lunch break')) return false;
                const entryTime = new Date(e.clock_in).getTime();
                // Match within 5 minutes tolerance
                return Math.abs(entryTime - originalReturnTime) < 5 * 60 * 1000;
              });
              
              if (matchingEntry) {
                console.log('Found return entry by clock_in time:', matchingEntry);
                const returnResponse = await api.put(`/time/entries/${matchingEntry.id}`, {
                  clock_in: centralToUTC(formData.lunch_return_clock_in)
                });
                console.log('Return entry updated:', returnResponse.data);
              } else {
                // Fall through to search by position
                console.log('No matching entry found by clock_in time, searching by position...');
              }
            } catch (searchErr) {
              console.error('Error searching for return entry by clock_in:', searchErr);
              // Fall through to search by position
            }
          }
          
          // If we still haven't found the return entry, search for it by position
          if (!foundReturnEntry) {
            // Find the next entry after this lunch break to update
            try {
              // Look for entries on the same day, but also check next day in case lunch spans midnight
              const lunchDate = new Date(entry.clock_in);
              const lunchDateStr = lunchDate.toISOString().split('T')[0];
              
              // Also check the next day in case the return entry is there
              const nextDay = new Date(lunchDate);
              nextDay.setDate(nextDay.getDate() + 1);
              const nextDayStr = nextDay.toISOString().split('T')[0];
              
              const entriesResponse = await api.get('/time/entries', {
                params: {
                  user_id: entry.user_id,
                  start_date: lunchDateStr,
                  end_date: nextDayStr
                }
              });
              
              const lunchOutTime = new Date(lunchUpdateData.clock_out);
              const lunchOutDateStr = lunchOutTime.toISOString().split('T')[0];
              
              console.log('Searching for return entry from:', lunchDateStr, 'to', nextDayStr);
              console.log('Lunch break clock_out:', lunchUpdateData.clock_out);
              console.log('Lunch break entry ID:', entry.id);
              console.log('Total entries found:', entriesResponse.data.entries.length);
              
              // Find the entry that comes after the lunch break
              // It should be the next clock-in after the lunch clock-out
              // Exclude lunch break entries (notes contain "lunch break")
              
              // CRITICAL: Only look for return entries on the SAME DAY as the lunch break
              // A lunch break return should NEVER be on a different day
              // This prevents accidentally matching a new day's clock-in as a lunch return
              const candidateEntries = entriesResponse.data.entries
                .filter(e => {
                  // Exclude the lunch break entry itself
                  if (e.id === entry.id) {
                    console.log(`[Same-day filter] Excluding lunch break entry: ${e.id}`);
                    return false;
                  }
                  // Exclude other lunch break entries
                  if (e.notes && e.notes.toLowerCase().includes('lunch break')) {
                    console.log(`[Same-day filter] Excluding other lunch break entry: ${e.id}`);
                    return false;
                  }
                  // Must have a clock_in time
                  if (!e.clock_in) {
                    console.log(`[Same-day filter] Excluding entry without clock_in: ${e.id}`);
                    return false;
                  }
                  
                  const entryInTime = new Date(e.clock_in);
                  const entryDateStr = entryInTime.toISOString().split('T')[0];
                  const isAfter = entryInTime > lunchOutTime;
                  
                  // CRITICAL: Must be on the SAME DAY and AFTER the lunch break
                  const isValid = entryDateStr === lunchOutDateStr && isAfter;
                  
                  console.log(`[Same-day filter] Entry ${e.id}: clock_in=${e.clock_in}, date=${entryDateStr}, lunchOutDate=${lunchOutDateStr}, isAfter=${isAfter}, isValid=${isValid}`);
                  return isValid;
                })
                .sort((a, b) => new Date(a.clock_in) - new Date(b.clock_in));
              
              console.log(`[Same-day filter] Found ${candidateEntries.length} candidate entries on same day`);
              
              console.log('Candidate entries after lunch:', candidateEntries);
              
              const nextEntry = candidateEntries[0]; // Get the earliest one after lunch
              
              if (nextEntry) {
                console.log('Found return entry:', nextEntry);
                const returnResponse = await api.put(`/time/entries/${nextEntry.id}`, {
                  clock_in: centralToUTC(formData.lunch_return_clock_in)
                });
                console.log('Found and updated return entry:', returnResponse.data);
              } else {
                // No return entry found - if admin is editing, create the return entry
                if (isAdmin && formData.lunch_return_clock_in) {
                  console.log('Admin creating return entry for lunch break');
                  try {
                    const createResponse = await api.post('/time/entries', {
                      user_id: entry.user_id,
                      clock_in: centralToUTC(formData.lunch_return_clock_in),
                      clock_out: null,
                      break_minutes: 0,
                      notes: null
                    });
                    console.log('Created return entry:', createResponse.data);
                    // Mark as found so we don't show the warning
                    foundReturnEntry = true;
                  } catch (createErr) {
                    console.error('Error creating return entry:', createErr);
                    const errorMsg = createErr.response?.data?.error || 'Failed to create return entry';
                    setError(`Failed to create return entry: ${errorMsg}`);
                    setLoading(false);
                    return; // Stop here if creation failed
                  }
                } else if (!isAdmin) {
                  // Not admin - just warn
                  console.warn('No return entry found on same day. Lunch break was updated, but return time cannot be set until employee clocks back in.');
                }
              }
            } catch (err) {
              console.error('Error finding return entry:', err);
              // Don't fail the entire save - the lunch break entry was updated
              // Just log the error
            }
          }
        }
        
        // Call onUpdate to refresh the view
        if (onUpdate) {
          onUpdate();
        }
      } else {
        // Regular update
        const response = await api.put(`/time/entries/${entry.id}`, updateData);
        console.log('Time entry updated:', response.data);
        
        if (onUpdate) {
          onUpdate(response.data.entry);
        }
      }
      
      onClose();
    } catch (err) {
      console.error('Error saving time entry:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update time entry';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!entry) return null;

  // Check if this is a lunch break - either from notes or explicit flag
  const isLunchBreak = entry.isLunchBreak || (entry.notes && entry.notes.toLowerCase().includes('lunch break'));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-xl border border-transparent dark:border-neutral-700 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">
              {isLunchBreak ? 'Edit Lunch Break' : 'Edit Time Entry'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                Employee
              </label>
              <input
                type="text"
                value={entry.user_name || entry.username || 'Unknown'}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg bg-gray-100 dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
              />
            </div>

            {!isLunchBreak && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                  Clock In *
                </label>
                <input
                  type="datetime-local"
                  name="clock_in"
                  value={formData.clock_in}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                />
              </div>
            )}
            
            {isLunchBreak && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                  Work Start Time (Before Lunch)
                </label>
                <input
                  type="datetime-local"
                  name="clock_in"
                  value={formData.clock_in}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg bg-gray-100 dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                />
                <p className="text-xs text-gray-500 dark:text-neutral-100 mt-1">This is when work started before lunch (read-only)</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                {isLunchBreak ? 'Lunch Start Time (Clock Out) *' : 'Clock Out'}
              </label>
              <input
                type="datetime-local"
                name="clock_out"
                value={formData.clock_out}
                onChange={handleChange}
                required={isLunchBreak}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
              />
              {!isLunchBreak && (
                <p className="text-xs text-gray-500 dark:text-neutral-100 mt-1">Leave empty if still clocked in</p>
              )}
              {isLunchBreak && (
                <p className="text-xs text-gray-500 dark:text-neutral-100 mt-1">Time when employee went to lunch</p>
              )}
            </div>

            {isLunchBreak && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                  Lunch End Time (Clock Back In)
                </label>
                <input
                  type="datetime-local"
                  name="lunch_return_clock_in"
                  value={formData.lunch_return_clock_in}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                />
                <p className="text-xs text-gray-500 dark:text-neutral-100 mt-1">
                  Time when employee returned from lunch. Leave empty if they haven't returned yet. The system will find and update the correct entry automatically.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                Break Minutes
              </label>
              <input
                type="number"
                name="break_minutes"
                value={formData.break_minutes}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 placeholder-gray-500 dark:placeholder-neutral-400"
                placeholder="Optional notes about this time entry..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-100 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditTimeEntryModal;

