import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { calculateElapsedTime } from '../../utils/helpers';
import LunchModal from './LunchModal';
import LunchOvertimeModal from './LunchOvertimeModal';
import CleanupReminderModal from './CleanupReminderModal';

const ClockInOut = () => {
  const [status, setStatus] = useState({ clockedIn: false, elapsedHours: '0:00' });
  const [loading, setLoading] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [notes, setNotes] = useState('');
  const [showLunchModal, setShowLunchModal] = useState(false);
  const [lunchOvertimeMinutes, setLunchOvertimeMinutes] = useState(null);
  const [isOnLunchBreak, setIsOnLunchBreak] = useState(false);
  const [showCleanupReminder, setShowCleanupReminder] = useState(false);
  const [cleanupReminderMessage, setCleanupReminderMessage] = useState('');

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (status.clockedIn && status.entry) {
      const interval = setInterval(async () => {
        // Reload status to get updated total elapsed time from backend
        try {
          const response = await api.get('/time/current');
          if (response.data.clockedIn) {
            // Use totalElapsedMs directly from backend - this is the accurate day total
            setStatus(prev => ({
              ...prev,
              elapsedHours: calculateElapsedTime(null, response.data.totalElapsedMs)
            }));
          }
        } catch (error) {
          // Fallback to client-side calculation if API fails
          setStatus(prev => ({
            ...prev,
            elapsedHours: calculateElapsedTime(prev.entry?.clock_in)
          }));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status.clockedIn, status.entry]);

  const loadStatus = async () => {
    try {
      const response = await api.get('/time/current');
      if (response.data.clockedIn) {
        // Use totalElapsedMs from backend directly - this is the accurate day total
        // Use originalClockIn for display if available, otherwise use entry.clock_in
        const displayClockIn = response.data.originalClockIn || response.data.entry?.original_clock_in || response.data.entry?.clock_in;
        setStatus({
          ...response.data,
          entry: {
            ...response.data.entry,
            clock_in: displayClockIn // Use original clock-in for display
          },
          elapsedHours: calculateElapsedTime(null, response.data.totalElapsedMs)
        });
      } else {
        setStatus(response.data);
      }
      
      // Check if employee is on lunch break (clocked out with lunch break note)
      if (!response.data.clockedIn) {
        // Check the most recent entry to see if it's a lunch break
        try {
          const entriesResponse = await api.get('/time/entries', {
            params: {
              start_date: new Date().toISOString().split('T')[0],
              end_date: new Date().toISOString().split('T')[0]
            }
          });
          
          // Find the most recent entry
          const recentEntry = entriesResponse.data.entries
            .filter(e => e.clock_out && e.notes && e.notes.toLowerCase().includes('lunch break'))
            .sort((a, b) => new Date(b.clock_out) - new Date(a.clock_out))[0];
          
          // Check if this lunch break entry doesn't have a return entry yet
          if (recentEntry) {
            // Check if there's a clock-in after this lunch break
            const returnEntry = entriesResponse.data.entries.find(e => {
              if (!e.clock_in || e.id === recentEntry.id) return false;
              const returnTime = new Date(e.clock_in);
              const lunchOutTime = new Date(recentEntry.clock_out);
              return returnTime > lunchOutTime;
            });
            
            // If no return entry found, they're still on lunch break
            setIsOnLunchBreak(!returnEntry);
          } else {
            setIsOnLunchBreak(false);
          }
        } catch (err) {
          console.error('Error checking lunch break status:', err);
          setIsOnLunchBreak(false);
        }
      } else {
        setIsOnLunchBreak(false);
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const handleClockIn = async () => {
    setLoading(true);
    try {
      const response = await api.post('/time/clock-in');
      await loadStatus();
      
      // Check if there was lunch overtime
      if (response.data.lunchOvertimeMinutes !== null && response.data.lunchOvertimeMinutes !== undefined) {
        setLunchOvertimeMinutes(response.data.lunchOvertimeMinutes);
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to clock in');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      const response = await api.post('/time/clock-out', {
        break_minutes: parseInt(breakMinutes) || 0,
        notes: notes || null
      });
      
      await loadStatus();
      setBreakMinutes(0);
      setNotes('');
      
      // Check if we should show cleanup reminder
      if (response.data.showCleanupReminder) {
        console.log('[Cleanup Reminder] Backend says to show reminder, loading message...');
        // Load the reminder message
        try {
          const reminderResponse = await api.get('/time/cleanup-reminder');
          const message = reminderResponse.data.message || 'Please remember to clean up your work station and area before leaving.';
          console.log('[Cleanup Reminder] Message loaded, showing modal');
          setCleanupReminderMessage(message);
          setShowCleanupReminder(true);
        } catch (reminderError) {
          console.error('[Cleanup Reminder] Error loading message:', reminderError);
          // If we can't load the message, use default
          setCleanupReminderMessage('Please remember to clean up your work station and area before leaving.');
          setShowCleanupReminder(true);
        }
      } else {
        console.log('[Cleanup Reminder] Backend says NOT to show reminder');
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to clock out');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCleanupAcknowledge = async () => {
    try {
      // Record the acknowledgment
      await api.post('/time/cleanup-acknowledge', {
        message_shown: cleanupReminderMessage
      });
    } catch (error) {
      console.error('Error recording cleanup acknowledgment:', error);
      // Don't block the user, just log the error
    }
    setShowCleanupReminder(false);
    setCleanupReminderMessage('');
  };

  const handleGoToLunch = async () => {
    setLoading(true);
    try {
      // Clock out with 60 minutes break (1 hour lunch) and a note
      // Note: 'Lunch break' in notes tells backend not to show cleanup reminder
      await api.post('/time/clock-out', {
        break_minutes: 60,
        notes: 'Lunch break'
      });
      await loadStatus();
      // Explicitly do NOT show cleanup reminder for lunch breaks
      // Backend should already prevent this, but we ensure it here too
      setShowCleanupReminder(false);
      setShowLunchModal(true);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to go to lunch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center">
      <div className={`inline-block p-8 rounded-full mb-4 ${
        status.clockedIn ? 'bg-success' : 'bg-gray-300'
      }`}>
        <div className="text-white text-6xl font-bold">
          {status.clockedIn ? '✓' : '○'}
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-2">
        {status.clockedIn ? 'Clocked In' : 'Clocked Out'}
      </h2>

      {status.clockedIn && (
        <div className="mb-4">
          <p className="text-lg text-gray-600">
            Time Elapsed: <span className="font-bold">{status.elapsedHours}</span>
          </p>
        </div>
      )}

      {!status.clockedIn ? (
        <button
          onClick={handleClockIn}
          disabled={loading}
          className={`w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 text-white rounded-lg text-base md:text-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 mx-auto active:scale-95 min-h-[44px] ${
            isOnLunchBreak 
              ? 'bg-orange-500 hover:bg-orange-600' 
              : 'bg-success hover:bg-green-600'
          }`}
        >
          {isOnLunchBreak ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {loading ? 'Returning from Lunch...' : '🍽️ Return from Lunch'}
            </>
          ) : (
            loading ? 'Clocking In...' : 'Clock In'
          )}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="max-w-md mx-auto space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Break Minutes (optional)
            </label>
            <input
              type="number"
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              min="0"
              placeholder="0"
            />
            <label className="block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              rows="2"
              placeholder="Add notes..."
            />
          </div>
          <div className="flex flex-col gap-3 max-w-md mx-auto">
            <button
              onClick={handleGoToLunch}
              disabled={loading}
              className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 bg-orange-500 text-white rounded-lg text-base md:text-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 min-h-[44px]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {loading ? 'Going to Lunch...' : '🍽️ Go to Lunch'}
            </button>
            <button
              onClick={handleClockOut}
              disabled={loading}
              className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 bg-danger text-white rounded-lg text-base md:text-lg font-semibold hover:bg-red-600 transition disabled:opacity-50 active:scale-95 min-h-[44px]"
            >
              {loading ? 'Clocking Out...' : 'Clock Out'}
            </button>
          </div>
        </div>
      )}

      {showLunchModal && (
        <LunchModal onClose={() => setShowLunchModal(false)} />
      )}

      {lunchOvertimeMinutes !== null && (
        <LunchOvertimeModal 
          overtimeMinutes={lunchOvertimeMinutes} 
          onClose={() => setLunchOvertimeMinutes(null)} 
        />
      )}

      {showCleanupReminder && (
        <CleanupReminderModal
          message={cleanupReminderMessage}
          onAcknowledge={handleCleanupAcknowledge}
        />
      )}
    </div>
  );
};

export default ClockInOut;

