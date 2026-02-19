import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDateTime } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';

// Central Time Zone (Houston, Texas)
const CENTRAL_TIMEZONE = 'America/Chicago';

// Convert UTC datetime string to Central Time datetime-local format
const toCentralDateTime = (utcString) => {
  if (!utcString) return '';
  try {
    const utcDate = new Date(utcString);
    if (isNaN(utcDate.getTime())) return '';
    
    // Use Intl.DateTimeFormat to get Central Time components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(utcDate);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hours = parts.find(p => p.type === 'hour').value;
    const minutes = parts.find(p => p.type === 'minute').value;
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.warn('Error converting UTC to Central Time:', utcString, error);
    return '';
  }
};

// Convert Central Time datetime-local format to UTC ISO string
const centralToUTC = (centralDateTime) => {
  if (!centralDateTime) return null;
  try {
    // Parse the datetime-local string (YYYY-MM-DDTHH:mm)
    const [datePart, timePart] = centralDateTime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    
    // Create a date string in ISO format for the Central Time moment
    // We'll create a UTC date and then adjust it to represent Central Time
    // Method: Create a test date at the target Central Time, format it in both timezones to get offset
    
    // Create a reference date at the target Central Time
    // Use a known UTC time and see what Central Time it represents, then work backwards
    const testUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // Noon UTC on target date
    const testCentral = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(testUTC);
    
    const testCentralHour = parseInt(testCentral.find(p => p.type === 'hour').value);
    const testUTCHour = 12; // We set it to noon UTC
    
    // Calculate offset: if Central Time shows 6 AM when UTC is noon, offset is -6 hours
    const offsetHours = testCentralHour - testUTCHour;
    if (testCentralHour < testUTCHour) {
      // Central Time is behind UTC (e.g., 6 AM CT = 12 PM UTC means -6 hours)
      // But we need to check if it's the same day
      const testCentralDay = parseInt(testCentral.find(p => p.type === 'day').value);
      if (testCentralDay < day) {
        // Central Time day is behind, so offset is more negative
        // Actually, let's use a simpler approach
      }
    }
    
    // Simpler: Create UTC date for Central Time midnight, then add hours/minutes
    // Central Time midnight on the target date = UTC (day, 6:00) or (day-1, 5:00) depending on DST
    // Calculate offset dynamically by checking what UTC time corresponds to Central Time midnight
    const centralMidnightUTC = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`);
    const centralMidnightFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      hour: '2-digit',
      hour12: false
    }).format(centralMidnightUTC);
    
    // Actually, much simpler: use the reverse of toCentralDateTime
    // If we have Central Time components, create a UTC date that when formatted in Central Time gives us those components
    // We can iterate or use a known formula
    
    // Most reliable: Create date at target Central Time, get its UTC equivalent
    // Use Date constructor with timezone offset
    // For December (CST), offset is UTC-6, so Central Time = UTC + 6 hours
    // But DST makes this variable, so calculate dynamically
    
    // Create a date representing Central Time, then get UTC
    // Method: Create UTC date, format in Central Time, adjust until it matches
    let utcCandidate = new Date(Date.UTC(year, month - 1, day, hours + 6, minutes, 0)); // Assume UTC-6 (CST)
    
    // Verify and adjust if needed
    const verifyCentral = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(utcCandidate);
    
    const verifyYear = parseInt(verifyCentral.find(p => p.type === 'year').value);
    const verifyMonth = parseInt(verifyCentral.find(p => p.type === 'month').value);
    const verifyDay = parseInt(verifyCentral.find(p => p.type === 'day').value);
    const verifyHour = parseInt(verifyCentral.find(p => p.type === 'hour').value);
    const verifyMinute = parseInt(verifyCentral.find(p => p.type === 'minute').value);
    
    // Adjust if needed (should be close, might need ±1 hour for DST)
    if (verifyYear !== year || verifyMonth !== month || verifyDay !== day || verifyHour !== hours || verifyMinute !== minutes) {
      // Try with 5 hours offset (CDT, UTC-5)
      utcCandidate = new Date(Date.UTC(year, month - 1, day, hours + 5, minutes, 0));
      const verify2 = new Intl.DateTimeFormat('en-US', {
        timeZone: CENTRAL_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(utcCandidate);
      
      const v2Year = parseInt(verify2.find(p => p.type === 'year').value);
      const v2Month = parseInt(verify2.find(p => p.type === 'month').value);
      const v2Day = parseInt(verify2.find(p => p.type === 'day').value);
      const v2Hour = parseInt(verify2.find(p => p.type === 'hour').value);
      const v2Minute = parseInt(verify2.find(p => p.type === 'minute').value);
      
      if (v2Year === year && v2Month === month && v2Day === day && v2Hour === hours && v2Minute === minutes) {
        return utcCandidate.toISOString();
      }
    } else {
      return utcCandidate.toISOString();
    }
    
    // If neither worked, return the 6-hour offset version (most common for winter)
    return utcCandidate.toISOString();
  } catch (error) {
    console.warn('Error converting Central Time to UTC:', centralDateTime, error);
    // Fallback: assume UTC-6 (CST) - add 6 hours
    try {
      const [datePart, timePart] = centralDateTime.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      const fallbackDate = new Date(Date.UTC(year, month - 1, day, hours + 6, minutes, 0));
      return fallbackDate.toISOString();
    } catch {
      return null;
    }
  }
};

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
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              {isLunchBreak ? 'Edit Lunch Break' : 'Edit Time Entry'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee
              </label>
              <input
                type="text"
                value={entry.user_name || entry.username || 'Unknown'}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
              />
            </div>

            {!isLunchBreak && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Clock In *
                </label>
                <input
                  type="datetime-local"
                  name="clock_in"
                  value={formData.clock_in}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
            
            {isLunchBreak && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Start Time (Before Lunch)
                </label>
                <input
                  type="datetime-local"
                  name="clock_in"
                  value={formData.clock_in}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">This is when work started before lunch (read-only)</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isLunchBreak ? 'Lunch Start Time (Clock Out) *' : 'Clock Out'}
              </label>
              <input
                type="datetime-local"
                name="clock_out"
                value={formData.clock_out}
                onChange={handleChange}
                required={isLunchBreak}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {!isLunchBreak && (
                <p className="text-xs text-gray-500 mt-1">Leave empty if still clocked in</p>
              )}
              {isLunchBreak && (
                <p className="text-xs text-gray-500 mt-1">Time when employee went to lunch</p>
              )}
            </div>

            {isLunchBreak && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lunch End Time (Clock Back In)
                </label>
                <input
                  type="datetime-local"
                  name="lunch_return_clock_in"
                  value={formData.lunch_return_clock_in}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Time when employee returned from lunch. Leave empty if they haven't returned yet. The system will find and update the correct entry automatically.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Break Minutes
              </label>
              <input
                type="number"
                name="break_minutes"
                value={formData.break_minutes}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
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

